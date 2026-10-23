// GĐ 273: Helper dùng chung camera Chấm công + Check-in.
// 1) Crop WYSIWYG — ảnh lưu lấy đúng vùng trung tâm theo TỈ LỆ khung preview
//    (trước đây canvas lấy toàn bộ khung gốc camera trong khi preview chỉ hiển thị
//    một phần qua objectFit contain/cover → ảnh lưu bị trống phía trên + lệch trái).
// 2) GĐ 283 Beauty Pro — pipeline 3 lớp áp lên vùng đã crop, mô phỏng retouch
//    ảnh thẻ chất lượng cao:
//      Lớp 0 — BASE: cân bằng ánh sáng toàn ảnh (lift vùng tối + kéo vùng cháy sáng
//              về trung tính) + tăng tương phản nhẹ. Tự nhiên, không ám màu.
//      Lớp 1 — SMOOTH: blur bán trong suốt đè lên — mịn da, làm mềm khuyết điểm
//              tạm thời (mụn/vết thâm/nếp nhăn nhỏ chỉ MỜ ĐI — canvas thuần không
//              xóa theo vị trí được), quầng mắt/nếp nhăn nhẹ bớt rõ.
//      Lớp 2 — DETAIL: unsharp-mask (bản gốc nhòe nhẹ đè "overlay" bán
//              trong suốt) → mắt/tóc/đường viền khuôn mặt TĂNG NÉT rõ ràng mà
//              KHÔNG thay đổi hình dạng — bù lại phần nét bị lớp smooth lấy đi
//              → ảnh giống máy ảnh tốt chứ không phải ảnh AI.
//    Toàn bộ pipeline KHÔNG đụng hình dạng/tỷ lệ khuôn mặt, không tạo mặt mới.
//    Filter chỉ áp cho lớp ảnh — chữ đóng dấu vẽ SAU hàm này luôn nét.
// 3) GĐ 400 (12/10 — yêu cầu Đại ca):
//    a) Snapshot 1 frame — đọc video ĐÚNG 1 LẦN ở đầu hàm rồi mọi lớp vẽ từ
//       snapshot. Trước đây 4 lần drawImage(video) trong lúc stream đang phát →
//       người di chuyển thì 4 lớp lấy 4 frame khác nhau → ảnh mờ nhòe ghosting.
//    b) mirror (camera trước): lật gương đồng bộ preview ↔ ảnh/video lưu —
//       thấy gì ảnh ra nấy như camera điện thoại, người đứng giữa preview = giữa ảnh.
//    c) BASE mức GĐ 400 (nay GĐ 502 giảm 1 bậc): sáng hơn + bớt ám vàng (brightness 1.15 → 1.07 + contrast 1.08 +
//       saturate 0.82) + lớp WHITE BALANCE (soft-light xanh nhạt #9ecbff 35%)
//       làm nhạt ánh vàng đèn phòng một cách tự nhiên, da không bị khô xám.

export interface CameraCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Vùng crop TRUNG TÂM của frame camera theo tỉ lệ khung hiển thị (WYSIWYG). */
export function computeCenterCrop(
  frameW: number,
  frameH: number,
  viewW: number,
  viewH: number,
): CameraCrop {
  const fw = Math.max(1, Math.round(frameW));
  const fh = Math.max(1, Math.round(frameH));
  const vw = Math.max(1, Math.round(viewW));
  const vh = Math.max(1, Math.round(viewH));
  const frameAspect = fw / fh;
  const viewAspect = vw / vh;

  let sw = fw;
  let sh = fh;
  if (frameAspect > viewAspect) {
    // Frame RỘNG hơn khung (VD webcam ngang, khung dọc) → cắt 2 bên
    sw = Math.round(fh * viewAspect);
  } else if (frameAspect < viewAspect) {
    // Frame CAO/DỌC hơn khung (VD stream dọc iPhone, khung ngang) → cắt trên/dưới
    // → hết phần trống phía trên trong ảnh lưu
    sh = Math.round(fw / viewAspect);
  }
  return {
    sx: Math.round((fw - sw) / 2),
    sy: Math.round((fh - sh) / 2),
    sw,
    sh,
  };
}

export interface DrawFrameOptions {
  beauty: boolean;
  beautyFilter: string;
  /** Bán kính blur lớp mịn da (px trên ảnh gốc). Mặc định 9 (Beauty Pro). */
  blurPx?: number;
  /** Độ trong suốt lớp blur đè (0-1). Càng cao da càng mịn. Mặc định 0.42. */
  overlayAlpha?: number;
  /** Độ trong suốt lớp tăng nét (0-1). Mặc định 0.38. */
  detailAlpha?: number;
  /** GĐ 400: lật gương camera trước — preview và ảnh/video lưu cùng hướng. */
  mirror?: boolean;
}

/**
 * GĐ 408 (13/10 — Đại ca test thật thấy ảnh vẫn ám vàng): auto white-balance
 * GRAY-WORLD ngay trên snapshot — đo trung bình kênh màu của ẢNH NÀY, ánh vàng
 * đèn thì R+G cao / B thấp → nhân gain từng kênh về trung tính 70% (strength
 * 0.7 — đủ nhạt vàng mà da không bị xám), clamp gain 0.8-1.25 tránh quá tay.
 * "Theo ảnh" = đèn LED vàng, đèn sợi đốt, ánh tự nhiên... đều đo đúng mức riêng,
 * không phụ thuộc tham số tĩnh. Tối ưu: đo lấy mẫu mỗi 8 pixel (đủ chuẩn cho
 * trung bình toàn ảnh) rồi áp gain 1 pass cho cả ảnh.
 */
export function applyGrayWhiteBalance(canvas: HTMLCanvasElement, strength = 0.7): void {
  const c = canvas.getContext("2d");
  if (!c) return;
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  // Đo trung bình kênh trên mẫu (mỗi 8 pixel → 1/8 dữ liệu — đủ ổn định, nhanh)
  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  for (let i = 0; i < d.length; i += 32) {
    rSum += d[i]; gSum += d[i + 1]; bSum += d[i + 2]; n++;
  }
  const rAvg = rSum / n, gAvg = gSum / n, bAvg = bSum / n;
  const gray = (rAvg + gAvg + bAvg) / 3 || 1;
  // gain > 1 = kênh thiếu (bị ngả vàng/tím); < 1 = kênh dư. strength 0.7 + clamp.
  const rGain = clampGain(1 + ((gray / (rAvg || 1)) - 1) * strength);
  const gGain = clampGain(1 + ((gray / (gAvg || 1)) - 1) * strength);
  const bGain = clampGain(1 + ((gray / (bAvg || 1)) - 1) * strength);
  // Nếu gain gần 1 hết (ảnh đã trung tính — ban ngày) thì khỏi loop, khỏi ghi lại
  if (Math.abs(rGain - 1) < 0.01 && Math.abs(gGain - 1) < 0.01 && Math.abs(bGain - 1) < 0.01) return;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] * rGain;
    d[i + 1] = d[i + 1] * gGain;
    d[i + 2] = d[i + 2] * bGain;
  }
  c.putImageData(img, 0, 0);
}

/** Gain white-balance chặn trong [0.8, 1.25] — tránh ảnh bị lạnh/nóng quá tay. */
function clampGain(g: number): number {
  return g < 0.8 ? 0.8 : g > 1.25 ? 1.25 : g;
}

/** Cân bằng ánh sáng toàn ảnh: lift vùng tối + kéo vùng cháy sáng về trung tính.
 *  Cách chạy: vẽ ảnh vào canvas nội bộ qua filter rồi trả canvas —
 *  mọi pixel được xử lý thống nhất (khác CSS filter trên 1 element).
 *  GĐ 400: nguồn vào là SNAPSHOT (canvas đã crop, đã mirror) — chỉ vẽ 1 pass. */
function buildLightingLayer(
  source: HTMLCanvasElement,
  lightingFilter: string,
  w: number,
  h: number,
): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lctx = layer.getContext("2d");
  if (!lctx) {
    // Fallback: canvas rỗng (nếu nào tạo thất bại) — vẽ snapshot thuần thay vì trả canvas đen
    const fb = document.createElement("canvas");
    fb.width = w;
    fb.height = h;
    const fctx = fb.getContext("2d");
    if (fctx) {
      fctx.filter = "none";
      fctx.drawImage(source, 0, 0, w, h);
    }
    return fb;
  }
  lctx.filter = lightingFilter;
  lctx.drawImage(source, 0, 0, w, h);
  lctx.filter = "none";
  return layer;
}

/**
 * Vẽ frame camera lên canvas theo vùng crop + pipeline Beauty Pro khi beauty bật.
 * GĐ 400: đọc video ĐÚNG 1 LẦN thành snapshot — mọi lớp dùng chung 1 frame
 * (hết nhòe khi người di chuyển) + mirror áp 1 điểm duy nhất ở snapshot.
 * Lớp 0 BASE (cân bằng sáng/tương phản + bớt vàng) → WHITE BALANCE (soft-light
 * xanh nhạt làm lạnh ám vàng) → Lớp 1 SMOOTH (blur mịn da bán trong suốt)
 * → Lớp 2 DETAIL (unsharp-mask tăng nét mắt/tóc/viền — bù nét lớp smooth lấy đi).
 * Kết quả: da sạch đều màu tự nhiên, chi tiết nét như máy ảnh tốt, không vẻ AI.
 * Filter tắt ngay sau khi vẽ ảnh — mọi thứ vẽ sau (chữ dấu) phải nét.
 */
export function drawCameraFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  crop: CameraCrop,
  opts: DrawFrameOptions,
): void {
  const { sx, sy, sw, sh } = crop;
  const w = sw;
  const h = sh;

  // ── Snapshot: đọc video ĐÚNG 1 LẦN (mirror camera trước áp ngay tại đây) ──
  const snap = document.createElement("canvas");
  snap.width = w;
  snap.height = h;
  const sctx = snap.getContext("2d");
  if (sctx) {
    sctx.save();
    if (opts.mirror) {
      sctx.translate(w, 0);
      sctx.scale(-1, 1);
    }
    sctx.filter = "none";
    sctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    sctx.restore();
  }

  // ── Lớp 1 — frame gốc nét (beauty TẮT: đúng như cũ, dừng sớm) ──
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.drawImage(snap, 0, 0);

  if (!opts.beauty) return;

  // ── GĐ 408: auto white-balance GRAY-WORLD trên snapshot TRƯỚC các lớp làm
  // đẹp — đo độ ngả vàng của chính ảnh này rồi trừ 70% → ảnh bớt vàng theo
  // nguồn sáng thực tế (khớp ĐH chốt "auto white-balance theo ảnh"), da không
  // xám. Chỉ chạy khi beauty BẬT (beauty tắt = ảnh gốc nguyên bản).
  applyGrayWhiteBalance(snap, 0.7);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.drawImage(snap, 0, 0); // vẽ lại bản đã cân màu thay bản gốc vừa vẽ

  // ── Lớp 0 — BASE: cân bằng ánh sáng + tương phản nhẹ (canvas nội bộ) ──
  // GĐ 400 mức VỪA (đại ca chốt 12/10): brightness 1.07→1.15 (sáng hơn),
  // contrast 1.06→1.08, saturate 0.97→0.82 (vàng là màu bão hòa thấp của
  // ánh đèn vàng — giảm saturation làm nhạt ám vàng, da trung tính hơn).
  // GĐ 502 (22/10 — Đại Ca: "giảm độ sáng của camera xuống 1 bậc"): brightness
  // 1.15 → 1.07 (về mức "vừa" Đại Ca từng chốt trước GĐ 400) — preview live 2
  // trang (check-in/cham-cong) đổi đồng bộ số để preview khớp ảnh lưu; giữ
  // contrast 1.08 + saturate 0.82 + auto WB nhận chữ từ (GĐ 408 a) + màu.
  const lightingFilter = "brightness(1.07) contrast(1.08) saturate(0.82)";
  const base = buildLightingLayer(snap, lightingFilter, w, h);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.drawImage(base, 0, 0);

  // ── Lớp 0b — WHITE BALANCE: làm lạnh ám vàng (GĐ 400) ──
  // soft-light với xanh dương nhạt #9ecbff — GĐ 408 nâng 0.35→0.5 cùng auto-WB.
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#9ecbff";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── Lớp 1 — SMOOTH: mịn da bán trong suốt ──
  // blur 9px @1080p: mức "da sạch tự nhiên" — mụn/thâm/nếp nhăn nhỏ mờ rõ,
  // không đủ để biến thành bức tượng sáp. Alpha 0.42: đủ thấy khác biệt ngay
  // trên preview (lesson GĐ 245 — mức quá nhẹ = "không thấy thay đổi").
  ctx.save();
  ctx.globalAlpha = opts.overlayAlpha ?? 0.42;
  ctx.filter = `blur(${opts.blurPx ?? 9}px) ${opts.beautyFilter}`;
  ctx.drawImage(snap, 0, 0);
  ctx.restore();

  // ── Lớp 2 — DETAIL: unsharp-mask tăng nét mắt/tóc/viền mặt ──
  // Bản gốc crop nhòe nhẹ (blur 1.5px) đè "overlay" alpha 0.38 — chỉ phần
  // VIỀN/CHI TIẾT tương phản cao (mắt, mi, tóc, viền mặt) được đẩy nét lên,
  // vùng da phẳng không đổi → giữ nguyên kết cấu da tự nhiên, không "AI".
  const blurLayer = buildLightingLayer(snap, "blur(1.5px)", w, h);
  ctx.save();
  ctx.globalAlpha = opts.detailAlpha ?? 0.38;
  ctx.globalCompositeOperation = "overlay";
  ctx.filter = "none";
  ctx.drawImage(blurLayer, 0, 0);
  ctx.restore();

  // Luôn tắt filter + trả alpha/composite về mặc định — mọi thứ vẽ sau nét
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
