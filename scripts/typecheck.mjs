/**
 * Typecheck qua TypeScript API — thay thế `tsc --noEmit` CLI.
 *
 * VÌ SAO CẦN SCRIPT NÀY (GĐ 70):
 * tsc CLI trên máy của Đại ca trả kết quả SAI (đặt lỗi `const x: number = 'chuoi'`
 * vào project vẫn báo 0 lỗi) — gần như chắc chắn do node_modules bị Google Drive
 * sync corrupt. TypeScript LIBRARY vẫn ổn — script này gọi ts.createProgram trực
 * tiếp và đã verified bắt đúng các lỗi thật mà CLI bỏ qua.
 *
 * Cách chạy:  node scripts/typecheck.mjs
 * Exit code:  0 = chỉ có lỗi .mjs lạ (bị loại); 1 = có lỗi TS/TSX trong dự án.
 *
 * Baseline: 26 lỗi có sẵn từ các giai đoạn trước (cham-cong, check-in, store.ts
 * 669/680, data.ts 264/391 serializable...). Script in TỔNG SỐ + danh sách —
 * so sánh số lượng trước/sau mỗi lần sửa để biết có thêm lỗi mới không.
 */
import ts from "typescript";

const cfg = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (cfg.error) {
  console.error("tsconfig.json lỗi:", ts.flattenDiagnosticMessageText(cfg.error.messageText, " "));
  process.exit(1);
}
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ".");
if (parsed.errors.length > 0) {
  for (const e of parsed.errors) {
    console.error("tsconfig parse:", ts.flattenDiagnosticMessageText(e.messageText, " "));
  }
  process.exit(1);
}

const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: { ...parsed.options, noEmit: true },
});

const all = ts.getPreEmitDiagnostics(program);
const isStrayMjs = (d) => String(d.file?.fileName ?? "").includes(".mjs");
const real = all.filter((d) => !isStrayMjs(d));
const strayCount = all.length - real.length;

console.log(`Tổng số diagnostics: ${all.length} (bỏ qua ${strayCount} từ file .mjs lạ)`);

for (const d of real) {
  const f = d.file;
  const pos = f
    ? `${f.fileName.split("\\").join("/")}:${f.getLineAndCharacterOfPosition(d.start).line + 1}`
    : "(không có file)";
  const msg = ts.flattenDiagnosticMessageText(d.messageText, " ").split("\n")[0];
  console.log(`  ${pos} — TS${d.code} — ${msg.slice(0, 200)}`);
}

console.log(
  real.length === 0
    ? "✅ Typecheck SẠCH (0 lỗi trong file TS/TSX dự án)"
    : `❌ ${real.length} lỗi thật trong file TS/TSX — so sánh với baseline 26 (GĐ 70)`,
);
process.exit(real.length === 0 ? 0 : 1);
