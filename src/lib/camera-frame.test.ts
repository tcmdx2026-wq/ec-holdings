// GĐ 283 — Unit test computeCenterCrop (logic thuần — chạy node --experimental-strip-types).
// Mục đích: chứng minh crop LUÔN lấy vùng GIỮA khung gốc camera theo tỉ lệ khung
// preview → ảnh lưu khớp preview 100%. Nếu "mặt lệch" còn trên ảnh chụp thì
// nguyên nhân là frame camera gốc (chủ thể không nằm giữa khung gốc) — KHÔNG
// phải logic crop (test này chứng minh crop đúng giữa mọi tỉ lệ).
// Chạy: node --experimental-strip-types --test src/lib/camera-frame.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCenterCrop, applyGrayWhiteBalance } from "./camera-frame.ts";

// GĐ 408 — test auto white-balance gray-world. Fake canvas object tối thiểu
// (getImageData/putImageData) nên chạy node thuần, không cần DOM.
function makeFakeCanvas(w: number, h: number, px: [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = px[0]; data[i + 1] = px[1]; data[i + 2] = px[2]; data[i + 3] = px[3]; }
  let written: Uint8ClampedArray | null = null;
  const ctx = {
    getImageData: () => ({ data: data, width: w, height: h }),
    putImageData: (img: any) => { written = img.data; },
  };
  const canvas = { width: w, height: h, getContext: () => ctx };
  return { canvas, data, written: () => written };
}

test("WB gray-world: ảnh NGẢ VÀNG đèn (R/G cao, B thấp) → B nhân lên, R/G kéo xuống — cân lại", () => {
  // Ảnh 64×1 toàn màu vàng đèn R=255 G=220 B=120
  const f = makeFakeCanvas(64, 1, [255, 220, 120, 255]);
  const beforeR = f.data[0], beforeG = f.data[1], beforeB = f.data[2];
  applyGrayWhiteBalance(f.canvas as any, 0.7);
  const d = f.written() ?? f.data;
  // gray = (255+220+120)/3 = 198.3
  // rGain = 1 + (198.3/255 − 1)*0.7 ≈ 0.844 → R ≈ 215
  // gGain ≈ 1 + (198.3/220 − 1)*0.7 ≈ 0.931 → G ≈ 205
  // bGain = 1 + (198.3/120 − 1)*0.7 ≈ 1.457 → clamp 1.25 → B ≈ 150
  assert.ok(d[0] < beforeR, `R phải giảm: ${d[0]} < ${beforeR}`);
  assert.ok(d[2] > beforeB, `B phải tăng: ${d[2]} > ${beforeB}`);
  assert.ok(d[0] > 195 && d[0] < 235, `R về giữa: ${d[0]}`);
  assert.ok(d[2] > 135 && d[2] < 165, `B kéo lên 1.25 cap (clamp): ${d[2]}`);
});

test("WB gray-world: ảnh TRUNG TÍNH (gains ≈ 1) → bỏ qua, không chạm ảnh", () => {
  const f = makeFakeCanvas(64, 1, [128, 128, 128, 255]);
  applyGrayWhiteBalance(f.canvas as any, 0.7);
  assert.equal(f.written(), null, "không putImageData khi ảnh đã trung tính");
  assert.equal(f.data[0], 128);
});

test("WB gray-world: clamp gain — ảnh xanh đậm làm gain B hạ sàn 0.8, không điên hóa ảnh", () => {
  // B=gắn cao: R=60,G=60,B=255 → gray=125 → rGain=1+((125/60)-1)*0.7=1.76→clamp 1.25; bGain=1+((125/255)-1)*0.7=0.643→clamp 0.8
  const f = makeFakeCanvas(64, 1, [60, 60, 255, 255]);
  applyGrayWhiteBalance(f.canvas as any, 0.7);
  const d = f.written() ?? f.data;
  assert.ok(d[0] <= 76, `R ×1.25 cap: ${d[0]} ≤ 76 (60*1.25=75)`);
  assert.ok(d[2] >= 200, `B ×0.8 sàn: ${d[2]} ≥ 200 (255*0.8=204)`);
});

test("crop khung ngang 1920×1080 → view dọc 3/4: lấy giữa theo chiều ngang", () => {
  const c = computeCenterCrop(1920, 1080, 3, 4);
  // sw = 1080 × 0.75 = 810; sx = (1920 − 810)/2 = 555 → ĐÚNG GIỮA
  assert.equal(c.sw, 810);
  assert.equal(c.sh, 1080);
  assert.equal(c.sx, 555);
  assert.equal(c.sy, 0);
  // Cân đối xứng: mép trái + mép phải = frame gốc
  assert.equal(c.sx + c.sw + c.sx, 1920);
});

test("crop khung dọc iPhone 1080×1920 → view dọc 3/4: lấy giữa theo chiều dọc", () => {
  const c = computeCenterCrop(1080, 1920, 3, 4);
  // sh = 1080 / 0.75 = 1440; sy = (1920 − 1440)/2 = 240 → ĐÚNG GIỮA
  assert.equal(c.sw, 1080);
  assert.equal(c.sh, 1440);
  assert.equal(c.sx, 0);
  assert.equal(c.sy, 240);
  assert.equal(c.sy + c.sh + c.sy, 1920);
});

test("crop webcam ngang cũ 640×480 → view 3/4: không lệch tâm", () => {
  const c = computeCenterCrop(640, 480, 3, 4);
  assert.equal(c.sw, 360);
  assert.equal(c.sx, 140);
  assert.equal((c.sx * 2) + c.sw, 640); // tâm cân
});

test("crop khung trùng tỉ lệ view → giữ nguyên frame (identity)", () => {
  const c = computeCenterCrop(750, 1000, 3, 4);
  assert.deepEqual(c, { sx: 0, sy: 0, sw: 750, sh: 1000 });
});

test("crop 0/1 kích thước lạ không crash, vẫn hợp lệ", () => {
  const c = computeCenterCrop(0, 0, 3, 4);
  assert.ok(c.sw >= 1 && c.sh >= 1);
  const c2 = computeCenterCrop(1, 1, 0, 0);
  assert.ok(c2.sw >= 1 && c2.sh >= 1);
});

test("crop view ngang 4/3 từ frame dọc → lấy giữa dọc (quay ngang điện thoại)", () => {
  const c = computeCenterCrop(1080, 1920, 4, 3);
  // sh = 1080 / (4/3) = 810; sy = (1920 − 810)/2 = 555
  assert.equal(c.sh, 810);
  assert.equal(c.sy, 555);
});
