// Script TẠM (GĐ 291 PA-C): verify query gộp countSourcesAll — đối chứng từng nguồn với query riêng
import { readFileSync } from "node:fs";

const GIST_ID = "db3dae34ac285bc7935a72f365cb0d21";
const GIST_FILE = "giong-tunnel-gist.txt";
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
} catch { /* */ }
let base = "";
try {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(15000),
  });
  if (res.ok) {
    const gist = await res.json();
    const m = (gist.files?.[GIST_FILE]?.content ?? "").match(/base_url:\s*(\S+)/);
    base = m ? m[1].replace(/\/$/, "") : "";
  }
} catch { /* */ }
if (!base) base = (env.TUNNEL_API_BASE_URL ?? "").replace(/\/$/, "");

async function q(sql, params = []) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": env.API_TOKEN ?? "" },
      body: JSON.stringify({ text: sql, params }),
      signal: AbortSignal.timeout(45000),
    });
    const t = await res.text();
    if (!res.ok) return { err: `HTTP ${res.status}: ${t.slice(0, 300)}`, ms: Date.now() - t0 };
    return { rows: JSON.parse(t).rows, ms: Date.now() - t0 };
  } catch (e) { return { err: e.message, ms: Date.now() - t0 }; }
}

// Tham số thật: kỳ chọn = Hôm qua (01/10), today = 02/10, monthStart = 01/10, company
const PF = "2026-10-01", PT = "2026-10-01", TD = "2026-10-02", M = "2026-10-01", U = "company";
const u = `($4 = 'company' OR center = $4)`;
const symCases = Object.entries({
  "1C26MAE": "BH", "1C26MAH": "CĐ", "1C26MAM": "ĐX", "1C26MAQ": "ĐY", "1C26MAO": "HM",
  "1C26MAA": "LB", "1C26MAJ": "LM", "1C26MAF": "ML", "1C26MAR": "NL", "1C26MAL": "PY",
  "1C26MAD": "QO", "1C26MAB": "SĐ", "1C26MAK": "TA", "1C26MAP": "TD", "1C26MAI": "TĐ",
  "1C26MAC": "TO", "1C26MAG": "TP", "1C26MAN": "TS", "1C26MAS": "TT",
}).map(([s, c]) => `WHEN '${s}' THEN '${c}'`).join(" ");
const inv = (range) =>
  `(SELECT COUNT(*) FROM (SELECT CASE col2 ${symCases} END AS ctr FROM dbo.stg_11BKCT WHERE report_date BETWEEN ${range} AND col1 <> '') t WHERE ctr IS NOT NULL AND ($4 = 'company' OR ctr = $4))`;

// QUERY GỘP MỚI (y hệt code)
const merged = await q(`SELECT
   (SELECT COUNT(*) FROM dbo.stg_12BLTH WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ${u}) AS blth_p,
   (SELECT COUNT(*) FROM dbo.stg_2DTTDT WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ${u}) AS dtdt_p,
   (SELECT COUNT(*) FROM dbo.stg_5BKN WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ${u}) AS bkn_p,
   (SELECT COUNT(*) FROM dbo.stg_6BKX WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ${u}) AS bkx_p,
   (SELECT COUNT(*) FROM dbo.stg_4BKCCN WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ${u}) AS bkccn_p,
   ${inv("$1 AND $2")} AS invoice_p,
   (SELECT COUNT(*) FROM dbo.stg_3DTTHC WHERE col1 <> '') AS dtthc_p,
   (SELECT COUNT(*) FROM dbo.stg_7BCNXT WHERE report_date = (SELECT MAX(report_date) FROM dbo.stg_7BCNXT WHERE report_date <= $2 AND ${u}) AND col1 <> '' AND ${u}) AS nxt_p,
   (SELECT COUNT(*) FROM dbo.stg_12BLTH WHERE report_date BETWEEN $3 AND $3 AND col1 <> '' AND ${u}) AS blth_t,
   (SELECT COUNT(*) FROM dbo.stg_2DTTDT WHERE report_date BETWEEN $3 AND $3 AND col1 <> '' AND ${u}) AS dtdt_t,
   (SELECT COUNT(*) FROM dbo.stg_5BKN WHERE report_date BETWEEN $3 AND $3 AND col1 <> '' AND ${u}) AS bkn_t,
   (SELECT COUNT(*) FROM dbo.stg_6BKX WHERE report_date BETWEEN $3 AND $3 AND col1 <> '' AND ${u}) AS bkx_t,
   (SELECT COUNT(*) FROM dbo.stg_4BKCCN WHERE report_date BETWEEN $3 AND $3 AND col1 <> '' AND ${u}) AS bkccn_t,
   ${inv("$3 AND $3")} AS invoice_t,
   (SELECT COUNT(*) FROM dbo.stg_7BCNXT WHERE report_date = (SELECT MAX(report_date) FROM dbo.stg_7BCNXT WHERE report_date <= $3 AND ${u}) AND col1 <> '' AND ${u}) AS nxt_t,
   (SELECT COUNT(*) FROM dbo.stg_12BLTH WHERE report_date BETWEEN $5 AND $3 AND col1 <> '' AND ${u}) AS blth_m,
   (SELECT COUNT(*) FROM dbo.stg_2DTTDT WHERE report_date BETWEEN $5 AND $3 AND col1 <> '' AND ${u}) AS dtdt_m,
   (SELECT COUNT(*) FROM dbo.stg_5BKN WHERE report_date BETWEEN $5 AND $3 AND col1 <> '' AND ${u}) AS bkn_m,
   (SELECT COUNT(*) FROM dbo.stg_6BKX WHERE report_date BETWEEN $5 AND $3 AND col1 <> '' AND ${u}) AS bkx_m,
   (SELECT COUNT(*) FROM dbo.stg_4BKCCN WHERE report_date BETWEEN $5 AND $3 AND col1 <> '' AND ${u}) AS bkccn_m,
   ${inv("$5 AND $3")} AS invoice_m
 `, [PF, PT, TD, U, M]);
console.log("1) Query GỘP:", merged.err ?? JSON.stringify(merged.rows?.[0]), `(${merged.ms}ms)`);

// QUERY RIÊNG đối chứng — today (02/10) 8 nguồn
const single = await q(`SELECT
   (SELECT COUNT(*) FROM dbo.stg_12BLTH WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ($3 = 'company' OR center = $3)) AS blth,
   (SELECT COUNT(*) FROM dbo.stg_2DTTDT WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ($3 = 'company' OR center = $3)) AS dtdt,
   (SELECT COUNT(*) FROM dbo.stg_5BKN WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ($3 = 'company' OR center = $3)) AS bkn,
   (SELECT COUNT(*) FROM dbo.stg_7BCNXT WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ($3 = 'company' OR center = $3)) AS nxt,
   (SELECT COUNT(*) FROM dbo.stg_11BKCT WHERE report_date BETWEEN $1 AND $2 AND col1 <> '') AS invoice,
   (SELECT COUNT(*) FROM dbo.stg_6BKX WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ($3 = 'company' OR center = $3)) AS bkx,
   (SELECT COUNT(*) FROM dbo.stg_4BKCCN WHERE report_date BETWEEN $1 AND $2 AND col1 <> '' AND ($3 = 'company' OR center = $3)) AS bkccn,
   (SELECT COUNT(*) FROM dbo.stg_3DTTHC WHERE col1 <> '') AS dtthc`, [TD, TD, U]);
console.log("2) Query RIÊNG today:", single.err ?? JSON.stringify(single.rows?.[0]), `(${single.ms}ms)`);

// Đối chứng từng nguồn: gộp _t (today) vs riêng today (lưu ý invoice riêng chưa map — chỉ so 5 nguồn map center + nxt)
if (merged.rows?.[0] && single.rows?.[0]) {
  const g = merged.rows[0], s = single.rows[0];
  const pairs = [
    ["blth", g.blth_t, s.blth], ["dtdt", g.dtdt_t, s.dtdt], ["bkn", g.bkn_t, s.bkn],
    ["bkx", g.bkx_t, s.bkx], ["bkccn", g.bkccn_t, s.bkccn],
  ];
  let ok = true;
  for (const [name, a, b] of pairs) {
    const same = Number(a) === Number(b);
    ok = ok && same;
    console.log(`${same ? "✅" : "❌"} ${name}: gộp=${a} · riêng=${b}`);
  }
  // invoice: riêng chưa map ký hiệu (đếm thô) — gộp đã map (có thể nhỏ hơn) — chỉ in
  console.log(`ℹ️ invoice: gộp(map TT)=${g.invoice_t} · riêng(thô)=${s.invoice} (thô ≥ map là bình thường)`);
  console.log(ok ? "✅ ĐỐI CHỨNG KHỚP từng nguồn" : "❌ LỆCH — dừng, soi lại SQL");
}

// Query import_log 3 cột
const logs = await q(`SELECT report_code,
   SUM(CASE WHEN report_date BETWEEN $1 AND $2 THEN 1 ELSE 0 END) AS n_p,
   SUM(CASE WHEN report_date = $3 THEN 1 ELSE 0 END) AS n_t,
   SUM(CASE WHEN report_date BETWEEN $4 AND $3 THEN 1 ELSE 0 END) AS n_m
 FROM dbo.import_log
 WHERE (report_date BETWEEN $1 AND $2 OR report_date BETWEEN $4 AND $3)
   AND report_code IN ($5, $6, $7, $8, $9, $10, $11, $12)
 GROUP BY report_code`, [PF, PT, TD, M, "12BLTH", "2DTTDT", "5BKN", "7BCNXT", "11BKCT", "6BKX", "4BKCCN", "3DTTHC"]);
console.log("3) import_log 3 cột:", logs.err ?? JSON.stringify(logs.rows), `(${logs.ms}ms)`);
