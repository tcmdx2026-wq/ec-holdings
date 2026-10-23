/**
 * GĐ 243 (28/09/2026 — yêu cầu Đại ca): PREFLIGHT PUSH — cổng kiểm bắt buộc
 * trước khi báo "đã push" + verify sau deploy.
 *
 * Bối cảnh: toast "Sai email hoặc mật khẩu" trên trang login là BÁO LỖI SAI —
 * lỗi thật là app mất kết nối GiondDB (Quick Tunnel đổi URL mỗi lần service
 * restart). Cần bắt lỗi này TRƯỚC khi tuyên bố push xong, tránh người dùng
 * không vào được app (quy tắc GĐ 167: kết luận "app lỗi" cần bằng chứng network).
 *
 * Cách chạy (node >= 20, không cần deps — thuần fetch):
 *   node scripts/preflight-push.mjs            # mode PRE-PUSH (trước khi báo anh "đã push")
 *   node scripts/preflight-push.mjs --verify   # mode POST-DEPLOY (sau khi Vercel Ready)
 *
 * Mode PRE-PUSH kiểm: (1) tunnel sống qua Gist + /health; (2) login production 200.
 * Mode --verify kiểm thêm: (3) bundle version khớp package.json (quy tắc GĐ 124).
 *
 * Credentials: đọc PREFLIGHT_EMAIL + PREFLIGHT_PASSWORD từ .env.local (gitignored)
 * — KHÔNG hardcode mật khẩu trong repo (quy tắc bảo mật GĐ 123).
 */

import { readFileSync } from "node:fs";

const PROD = "https://giong-vn-v6.vercel.app";
const GIST_ID = "db3dae34ac285bc7935a72f365cb0d21";
const GIST_FILE = "giong-tunnel-gist.txt";
const MODE_VERIFY = process.argv.includes("--verify");

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

// ---- Đọc .env.local (nếu có) ----
let env = {};
try {
  env = Object.fromEntries(
    readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
} catch { /* không có .env.local — bỏ qua */ }

// ---- Check 1: Tunnel sống (Gist URL hiện hành + /health) ----
async function checkTunnel() {
  let gistUrl = "";
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const gist = await res.json();
      const content = gist.files?.[GIST_FILE]?.content ?? "";
      const m = content.match(/base_url:\s*(\S+)/);
      gistUrl = m ? m[1].replace(/\/$/, "") : "";
    }
  } catch { /* gist fail — thử env */ }

  const base = gistUrl || (env.TUNNEL_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    check("Tunnel URL", false, "không lấy được từ Gist lẫn env");
    return;
  }
  try {
    const res = await fetch(`${base}/health`, {
      headers: env.API_TOKEN ? { "x-api-token": env.API_TOKEN } : {},
      signal: AbortSignal.timeout(15000),
    });
    check("Tunnel sống (GiondDB)", res.ok, `${base} → HTTP ${res.status}`);
  } catch (e) {
    check("Tunnel sống (GiondDB)", false, `${base} → ${e.message ?? "fetch failed"}`);
  }
}

// ---- Check 2: Đăng nhập production 200 ----
async function checkLogin() {
  const email = env.PREFLIGHT_EMAIL;
  const password = env.PREFLIGHT_PASSWORD;
  if (!email || !password) {
    check("Đăng nhập production", false, "thiếu PREFLIGHT_EMAIL/PREFLIGHT_PASSWORD trong .env.local");
    return;
  }
  try {
    const res = await fetch(`${PROD}/api/auth/sign-in/email`, {
      method: "POST",
      // Better Auth chặn request thiếu Origin (CSRF — MISSING_OR_NULL_ORIGIN 403)
      // → giả lập Origin như trình duyệt thật.
      headers: { "Content-Type": "application/json", Origin: PROD },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(30000),
    });
    check("Đăng nhập production", res.status === 200, `HTTP ${res.status}`);
  } catch (e) {
    check("Đăng nhập production", false, e.message ?? "fetch failed");
  }
}

// ---- Check 3 (--verify): bundle version khớp package.json ----
async function checkVersion() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const expect = pkg.version;
  try {
    const html = await (await fetch(PROD, { signal: AbortSignal.timeout(20000) })).text();
    const bundle = html.match(/\/assets\/index-[^"]*\.js/)?.[0];
    if (!bundle) { check("Bundle version", false, "không tìm thấy bundle trong HTML"); return; }
    const js = await (await fetch(PROD + bundle, { signal: AbortSignal.timeout(20000) })).text();
    check("Bundle version (GĐ 124)", js.includes(expect), `domain chính = ${expect ? expect : "?"}`);
  } catch (e) {
    check("Bundle version (GĐ 124)", false, e.message ?? "fetch failed");
  }
}

await checkTunnel();
await checkLogin();
if (MODE_VERIFY) await checkVersion();

const failed = results.filter((r) => !r.ok);
console.log("\n" + (failed.length === 0
  ? "🟢 PREFLIGHT PASS — được phép báo Đại ca 'đã push'."
  : `🔴 PREFLIGHT FAIL (${failed.length}/${results.length}) — KHÔNG được báo 'đã push'. Tự xử lý hoặc báo lỗi NGAY.`));
process.exit(failed.length === 0 ? 0 : 1);
