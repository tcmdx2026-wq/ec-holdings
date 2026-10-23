import { pendingMigrations } from "../../scripts/migration-plan.mjs";

/** Which database backend is active. */
export type DbSource = "tunnel" | "neon" | "pglite";

// An empty/whitespace DATABASE_URL (an easy misconfig in deploy UIs) must mean
// "unset" — otherwise production would silently run on the PGLite fallback.
const rawDatabaseUrl =
  typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl =
  rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

/**
 * GĐ 162 (PA-A): SQL Server GiongDB tại máy công ty qua Cloudflare Tunnel.
 * `TUNNEL_API_BASE_URL` = URL tunnel hiện hành (service GIONG_API_Server tự
 * đăng ký) + `API_TOKEN` xác thực. Ưu tiên CAO NHẤT — app tổng tách hẳn khỏi
 * Neon (không đốt egress, không chết khi Neon khóa quota — sự cố 14/10 18/09).
 */
const tunnelBaseUrl =
  typeof process !== "undefined"
    ? (process.env.TUNNEL_API_BASE_URL ?? "").trim()
    : "";
const apiToken =
  typeof process !== "undefined" ? (process.env.API_TOKEN ?? "").trim() : "";

/**
 * GĐ 169 (PA-1 — tự cập nhật URL Quick Tunnel, duyệt 19/09):
 * Quick Tunnel đổi URL mỗi lần tunnel restart — env TUNNEL_API_BASE_URL là
 * build-time, mỗi lần đổi phải sửa env + redeploy (điểm nghẽn vận hành).
 * Kênh mới: API Server (service GIONG_API_Server) tự PATCH **GitHub Secret
 * Gist** mỗi lần URL đổi (kênh NGOÀI tunnel — sống độc lập); app khi query
 * tunnel thất bại (tunnel chết/đổi URL) → đọc gist → lấy URL mới → cache
 * dùng tiếp. Không cần redeploy nữa.
 */
const gistToken =
  typeof process !== "undefined" ? (process.env.GH_GIST_TOKEN ?? "").trim() : "";
const gistId =
  typeof process !== "undefined" ? (process.env.TUNNEL_GIST_ID ?? "").trim() : "";

/**
 * Active backend: **tunnel** (SQL Server tại công ty — PA-A) khi có
 * `TUNNEL_API_BASE_URL`, else **Neon** khi `DATABASE_URL` set, else PGLite.
 */
export const dbSource: DbSource = tunnelBaseUrl
  ? "tunnel"
  : databaseUrl
    ? "neon"
    : "pglite";

/**
 * Minimal shared SQL surface, satisfied by both Neon and PGLite. Both the
 * tagged-template and `.query()` forms resolve to an array of row objects:
 *
 *   const sql = await getSql();
 *   const rows = await sql`select * from todos where id = ${id}`; // parameterized
 *   const rows2 = await sql.query("select * from todos where id = $1", [id]);
 */
export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

/**
 * Init state lives on globalThis as promises: dev HMR creates new instances of
 * this module, and two instances racing module-level state would open a second
 * pool or run two concurrent PGLite migration passes (whose duplicate
 * `_migrations` insert rejects — and would get memoized, poisoning every later
 * `getSql()`). A failed init clears its slot so the next call retries.
 */
const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __tunnelWarmup__?: number;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

/**
 * Result-type parity: Postgres sends every value as text plus a type OID — the
 * JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
 * int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
 * JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
 * production return identical, JSON-safe shapes:
 *   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
 *                                   `::text` if you ever need huge integers)
 *   date                         -> 'YYYY-MM-DD' string
 *   interval                     -> Postgres interval text
 * numeric already comes back as a string on both (arbitrary precision).
 */
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run: Run): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    // Rebuild with $1, $2, … placeholders so values stay parameterized.
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  return sql;
}

/**
 * GĐ 162 (PA-A): backend Tunnel — SQL Server GiongDB tại máy công ty.
 * Gọi API Server FastAPI (:8777, service GIONG_API_Server) qua Cloudflare
 * Tunnel: POST /query {text, params} → {rows}. API Server tự DỊCH SQL
 * PostgreSQL → T-SQL (CAST/now()/interval/LIMIT/ILIKE/RETURNING/ON CONFLICT —
 * đã test 15/15). Fetch mỗi lần query (không pool — serverless instance ngắn
 * hạn); timeout 30s + retry 1 lần cho lần gọi đầu (tunnel cold-start ~2-5s).
 */
/** Runner tunnel dùng chung — getSql() lẫn tunnel-dialect (Better Auth) đều gọi. */
export async function tunnelQueryRun<T>(
  text: string,
  params: unknown[],
): Promise<T[]> {
  return tunnelFetch<T>(text, params);
}

/* GĐ 169 — Runtime tunnel-URL resolution:
 * 1. env TUNNEL_API_BASE_URL (giá trị build-time — nhánh nhanh, cache 60s)
 * 2. GitHub Secret Gist (URL mới do API Server tự ghi khi tunnel đổi)
 * Cache module-level: gist chỉ được đọc 1 lần/giây tối đa, URL hợp lệ được
 * giữ trong memory cho tới khi được thay bằng URL mới hơn. */
let __tunnelUrlCache: { url: string; at: number; fromGist: boolean } | null = null;
let __gistFetchLock: Promise<string | null> | null = null;

function gistUrlExtract(text: string): string | null {
  const m = text.match(/^base_url:\s*(https:\/\/[a-z0-9-]+\.trycloudflare\.com)\s*$/m);
  return m ? m[1] : null;
}

export async function fetchTunnelUrlFromGist(): Promise<string | null> {
  if (!gistId) return null; // GĐ 426: gist public — đọc KHÔNG cần token bắt buộc
  __gistFetchLock ??= (async () => {
    try {
      const doFetch = (withToken: boolean) =>
        fetch(`https://api.github.com/gists/${gistId}`, {
          headers: {
            ...(withToken && gistToken
              ? { Authorization: `Bearer ${gistToken}` }
              : {}),
            Accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(10_000),
        });
      let res = await doFetch(true);
      // GĐ 426 (PA-1): GH_GIST_TOKEN hết hạn/revoke → GitHub 401 — gửi token
      // SAI còn tệ hơn KHÔNG gửi (gist public: không gửi = 200, sai = 401)
      // → retry KHÔNG token thay vì chết im lặng (sự cố 13/10: fallback chết
      // cả buổi tối, phải redeploy tay mới hồi phục).
      if (res.status === 401) res = await doFetch(false);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        files?: Record<string, { content?: string }>;
      };
      const content = json.files?.["giong-tunnel-gist.txt"]?.content ?? "";
      const url = gistUrlExtract(content);
      if (url) {
        __tunnelUrlCache = { url, at: Date.now(), fromGist: true };
        console.log(`[db] tunnel URL mới từ Gist: ${url}`);
      }
      return url;
    } catch {
      return null; // gist lỗi (mạng/token) — dùng URL cache/env hiện có
    } finally {
      // nhả lock sau 1s để lần fail tiếp theo (tunnel lại chết) còn được đọc lại
      setTimeout(() => {
        __gistFetchLock = null;
      }, 1_000);
    }
  })();
  return __gistFetchLock;
}

async function resolveTunnelBaseUrl(): Promise<string> {
  const cached = __tunnelUrlCache;
  // URL từ Gist (mới hơn env) dùng trực tiếp; URL từ env chỉ cache 60s để
  // cơ hội đọc Gist định kỳ (API Server có thể đã đổi URL lúc app không có traffic)
  if (cached && (cached.fromGist || Date.now() - cached.at < 60_000)) {
    return cached.url;
  }
  const envUrl = tunnelBaseUrl.replace(/\/+$/, "");
  if (envUrl) {
    __tunnelUrlCache = { url: envUrl, at: Date.now(), fromGist: false };
  }
  if (!envUrl) return envUrl; // không có env → trả rỗng (lỗi cấu hình, giữ hành vi cũ)
  void fetchTunnelUrlFromGist().catch(() => undefined); // nền: cập nhật cache sớm nếu có URL mới
  return envUrl;
}

async function tunnelFetch<T>(text: string, params: unknown[]): Promise<T[]> {
  const base = (await resolveTunnelBaseUrl()).replace(/\/+$/, "");
  const doFetch = (b: string) =>
    fetch(`${b}/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-token": apiToken,
      },
      body: JSON.stringify({ text, params }),
      signal: AbortSignal.timeout(30_000),
    });
  let res: Response | null = null;
  let lastErr: unknown = null;
  try {
    res = await doFetch(base);
  } catch (err) {
    lastErr = err;
    // Lần đầu sau cold-start (tunnel mới / instance mới) thường timeout —
    // thử lại 1 lần trước khi coi là tunnel chết.
    globalRef.__tunnelWarmup__ = (globalRef.__tunnelWarmup__ ?? 0) + 1;
    if (globalRef.__tunnelWarmup__ <= 2) {
      await new Promise((r) => setTimeout(r, 2_000));
      try {
        res = await doFetch(base);
        lastErr = null;
      } catch (err2) {
        lastErr = err2;
      }
    }
  }
  // GĐ 169: query vẫn fail sau retry → tunnel có thể đã đổi URL/chết ngầm →
  // đọc Gist lấy URL mới và thử ĐÚNG 1 LẦN trên URL mới.
  // ⚠️ !res.ok cũng phải đọc Gist: tunnel chết ngầm thường trả HTTP 530/5xx
  // CÓ response (Cloudflare edge vẫn resolve hostname cũ) — chỉ check res === null
  // sẽ bỏ sót trường hợp này (bắt được khi verify 13:13 — /api/units rỗng 0.6s).
  if ((res === null || !res.ok) && gistId) {
    const fresh = await fetchTunnelUrlFromGist();
    if (fresh && fresh !== base) {
      console.log(`[db] tunnel ${base} không phản hồi → thử URL mới từ Gist: ${fresh}`);
      try {
        res = await doFetch(fresh);
        lastErr = null;
      } catch (err3) {
        lastErr = err3;
      }
    }
  }
  if (res === null) {
    throw lastErr ?? new Error("Tunnel SQL: không kết nối được");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Tunnel SQL ${res.status}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { rows?: T[] };
  return json.rows ?? [];
}

function createTunnelSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    return toSql(tunnelFetch);
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

function createNeonSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    // Regular Postgres driver: node-postgres (`pg`) — works directly with Neon's
    // pooled endpoint. One pool per process; warm serverless instances reuse it.
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({ connectionString: databaseUrl });
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  // Embedded Postgres, imported on demand so it never loads on the Neon path.
  // One in-memory instance per process, shared across HMR module instances, so
  // data survives source edits (it resets on dev-server restart).
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  // Apply migrations/ (the single schema source) so preview matches production.
  // SQL is inlined by the bundler via import.meta.glob (no runtime fs); applied
  // files are tracked in _migrations. The glob does not descend, so the opt-in
  // auth schema under migrations/auth/ stays out. Runs once per module instance
  // — so an HMR reload after adding a migration file applies it live — with
  // passes serialized on a global chain so concurrent callers never
  // double-apply.
  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>(
      "select name from _migrations",
    );
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      // Apply + record atomically (parity with scripts/migrate.mjs) so a failed
      // statement can't leave a file half-applied but untracked.
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path]);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined) // an earlier failed pass must not wedge the chain
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  return dbSource === "tunnel"
    ? createTunnelSql()
    : dbSource === "neon"
      ? createNeonSql()
      : createPgliteSql();
}

/**
 * Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
 * otherwise the local PGLite fallback. Memoized — safe to call per request.
 *
 * Schema comes from `migrations/*.sql`, auto-applied before the first query on
 * both backends — define tables there, never inline in server functions.
 */
export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null; // don't memoize failures — let the next call retry
    throw err;
  });
  return sqlPromise;
}

/**
 * The shared PGLite instance (preview only), with `migrations/*.sql` applied.
 * Lets Better Auth persist to the SAME embedded DB as app data in preview (via a
 * Kysely dialect). Throws when `DATABASE_URL` is set (that path uses Neon).
 */
export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (dbSource !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

/**
 * Finish DB bootstrap before the server handles traffic.
 *
 * - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
 *   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
 * - **Neon**: no-op (pool is created lazily on first query).
 *
 * Vite `configureServer` awaits this at dev startup; production imports of this
 * module kick it off immediately (see bottom of file).
 */
export function ensureDbReady(): Promise<void> {
  if (dbSource !== "pglite") return Promise.resolve();
  return getSql().then(() => undefined);
}

// Server-only eager start: kick PGLite bootstrap as soon as this module loads in
// Node. Client bundles never hit this path (`getSql` throws in the browser).
const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
if (typeof window === "undefined" && dbSource === "pglite") {
  globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
    globalBoot.__pgBootstrapPromise__ = undefined;
    console.error("[db] PGLite bootstrap failed:", err);
    throw err;
  });
}
