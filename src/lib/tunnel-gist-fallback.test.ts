// GĐ 426 (PA-1) — Unit test fetchTunnelUrlFromGist (tự hồi phục URL Quick Tunnel).
// Bối cảnh: GH_GIST_TOKEN trên Vercel đã chết (GĐ 425 — token revoke, file
// .secrets rỗng) → GitHub 401 → fallback trả null IM LẶNG cả buổi tối 13/10
// (sự cố GĐ 424 "nhiệm vụ + lịch sử biến mất" — phải redeploy tay mới hồi).
// Fix PA-1: gist PUBLIC — đọc KHÔNG cần token; gặp 401 → tự retry KHÔNG token.
// Chạy: node --experimental-strip-types --test src/lib/tunnel-gist-fallback.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// env phải set TRƯỚC import — db.ts đọc env tại module load
process.env.GH_GIST_TOKEN = "token-da-chet-mo-phong";
process.env.TUNNEL_GIST_ID = "gist123test";

const { fetchTunnelUrlFromGist } = await import("./db.ts");

const GIST_200 = {
  files: {
    "giong-tunnel-gist.txt": {
      content: "base_url: https://tunnel-moi-moi.trycloudflare.com\n",
    },
  },
};

interface Step {
  status: number;
  json?: unknown;
}

function caiDatFetchFake(map: Step[]): Array<{ auth: boolean; status: number }> {
  let lan = 0;
  const log: Array<{ auth: boolean; status: number }> = [];
  globalThis.fetch = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    const step = map[Math.min(lan, map.length - 1)];
    const headers = init?.headers ?? {};
    const auth = "Authorization" in headers;
    log.push({ auth, status: step.status });
    lan += 1;
    const body =
      step.status === 200 ? JSON.stringify(step.json ?? GIST_200) : "401 Bad credentials";
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      text: async () => body,
      json: async () => JSON.parse(body),
    } as unknown as Response;
  }) as typeof fetch;
  return log;
}

const fetchGoc = globalThis.fetch;

test("GĐ 426 — token chết (401) → tự retry KHÔNG token → trả URL mới (PA-1)", async () => {
  const log = caiDatFetchFake([{ status: 401 }, { status: 200 }]);
  const url = await fetchTunnelUrlFromGist();
  assert.equal(url, "https://tunnel-moi-moi.trycloudflare.com");
  // lần 1 GỬI Authorization (token chết → 401), lần 2 KHÔNG gửi (gist public → 200)
  assert.deepEqual(log, [
    { auth: true, status: 401 },
    { auth: false, status: 200 },
  ]);
  await new Promise((r) => setTimeout(r, 1100)); // chờ lock nhả (nhả sau 1s)
});

test("GĐ 426 — token chết + retry vẫn 401 → trả null (giữ hành vi cũ khi gist thật sự lỗi)", async () => {
  const log = caiDatFetchFake([{ status: 401 }, { status: 401 }]);
  const url = await fetchTunnelUrlFromGist();
  assert.equal(url, null);
  assert.equal(log.length, 2);
  await new Promise((r) => setTimeout(r, 1100));
});

test("GĐ 426 — token hợp lệ (200 lần đầu) → KHÔNG retry thừa", async () => {
  const log = caiDatFetchFake([{ status: 200 }]);
  const url = await fetchTunnelUrlFromGist();
  assert.equal(url, "https://tunnel-moi-moi.trycloudflare.com");
  assert.equal(log.length, 1);
  await new Promise((r) => setTimeout(r, 1100));
});

globalThis.fetch = fetchGoc;
