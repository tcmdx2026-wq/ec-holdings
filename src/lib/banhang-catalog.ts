/**
 * GĐ 199 (2026-09-22) — CATALOG PHÂN QUYỀN CHI TIẾT app con Bán hàng
 * ====================================================================
 * Nguồn sự thật duy nhất cho trang Phân quyền app tổng khi cấu hình quyền
 * CHI TIẾT app con: 15 NHÓM (bậc 2) + TỪNG LÁ (bậc 3/4 — báo cáo/phân hệ).
 *
 * ⚠️ ĐỒNG BỘ 2 NƠI (bắt buộc khi thêm nhóm/báo cáo MỚI — xem CHECKLIST cuối file):
 *   - App tổng:  src/lib/banhang-catalog.ts (file này)
 *   - App con:   giong-apps/apps/banhang/src/lib/nav.ts (cây sidebar) + smed-auth.ts (REPORT_GROUP + route→nhóm) + components/app-shell.tsx (NAV_GROUP_TO_MOD)
 *
 * Mô hình (chốt Đại ca 22/09): NHÓM + TỪNG LÁ — mỗi nhóm 1 toggle tóm tắt
 * (bật = bật cả nhóm), xổ ra toggle từng lá. Quyền lưu trong cùng ô
 * module_access JSONB hiện có (không migration mới):
 *   - Nhóm: 4 key cũ "banhang-*" GIỮ NGUYÊN (không vỡ quyền đang chạy) +
 *     4 key mới "bh-bao-cao-ke-toan" / "bh-bao-cao-kho" / "bh-bao-cao-marketing" /
 *     "bh-upload-misa-amis" + GĐ 420 — 4 key "bh-nhap-*" (NHẬP DỮ LIỆU: DANH MỤC /
 *     KHO HÀNG / MUA HÀNG / BÁN HÀNG tách khỏi banhang-misa)
 *   - Lá: "bh-leaf-<routeLá>" (VD "bh-leaf-/m/misa-hoadon") — key = route lá, ổn định
 *
 * BACKWARD-COMPAT (chốt Đại ca — phương án 3):
 *   User ĐANG có quyền nhóm nào (config trước 22/09) → tự có đủ TẤT CẢ lá nhóm đó;
 *   đã bật "banhang" mà chưa config nhóm nào → đủ mọi nhóm + lá (giữ hành vi
 *   GĐ 108/143). Admin/SuperAdmin luôn đủ hết, không cần cấu hình.
 */

export type BhLeaf = {
  /** Route lá trong app con — đồng thời làm key quyền "bh-leaf-<to>" */
  to: string;
  /** Tên hiển thị trên trang Phân quyền (khớp nhãn nav.ts app con) */
  label: string;
};

export type BhGroup = {
  /** Key quyền lưu trong module_access */
  key: string;
  /** Nhãn hiển thị (khớp nhãn nhóm nav.ts app con) */
  label: string;
  leaves: BhLeaf[];
};

/** 15 nhóm bậc 2 của app con — 4 nhóm NHẬP DỮ LIỆU (bậc 1, GĐ 420) + 4 nhóm
 *  DOWNLOAD giữ key cũ + 3 BÁO CÁO + XEM BÁO CÁO MỌI NGƯỜI (GĐ 438) + UPLOAD
 *  + NHIỆM VỤ + BANK. */
export const BH_GROUPS: BhGroup[] = [
  // ============================================================
  // GĐ 420 (13/10 — yêu cầu Đại ca): NHẬP DỮ LIỆU — nhóm bậc 1 sidebar app con
  // (DANH MỤC → KHO HÀNG → MUA HÀNG → BÁN HÀNG) trước đây bị NHÉT vào nhóm
  // banhang-misa (backward-compat GĐ 223/336/340/370) → trang Phân quyền app
  // tổng KHÔNG có mục NHẬP DỮ LIỆU để cấu hình riêng (ĐH báo thiếu 13/10).
  // Nay TÁCH THÀNH 4 NHÓM RIÊNG theo đúng cây nav.ts app con — Admin cấp
  // quyền độc lập từng nhóm con. Đặt ĐẦU BH_GROUPS khớp thứ tự sidebar.
  // ⚠️ User ĐÃ có config nhóm (không rơi nhánh "chưa cấu hình → đủ hết") CẦN
  // được Admin bật lại 4 nhóm này nếu muốn xem — trước đây thấy qua nhóm MISA.
  // ============================================================
  {
    key: "bh-nhap-danh-muc",
    label: "NHẬP DỮ LIỆU — DANH MỤC",
    leaves: [
      { to: "/m/danh-muc-vac-xin", label: "Danh mục Vắc Xin" },
      { to: "/m/danh-muc-nha-cung-cap", label: "Danh mục Nhà cung cấp" },
      { to: "/m/danh-muc-trung-tam", label: "Danh mục Trung tâm" },
      { to: "/m/danh-muc-khach-hang", label: "Danh mục Khách hàng" },
      // GĐ 447 / C.274 (17/10 — ĐH chốt "1+2+3", GĐ 444 tồn đọng (b)): 3 danh mục
      // MISA (Kho · Vị trí · Mã thống kê) — seed từ file Excel ĐH gửi.
      { to: "/m/danh-muc-kho", label: "Danh mục Kho" },
      { to: "/m/danh-muc-vi-tri", label: "Danh mục Vị trí" },
      { to: "/m/danh-muc-ma-thong-ke", label: "Danh mục Mã thống kê" },
      { to: "/m/danh-muc-khac", label: "Danh mục khác" },
    ],
  },
  {
    key: "bh-nhap-kho-hang",
    label: "NHẬP DỮ LIỆU — KHO HÀNG",
    leaves: [
      { to: "/m/nhap-dieu-chuyen", label: "Điều chuyển nội bộ Vắc Xin" },
    ],
  },
  {
    key: "bh-nhap-mua-hang",
    label: "NHẬP DỮ LIỆU — MUA HÀNG",
    leaves: [
      // GĐ 429 (14/10/2026 — yêu cầu Đại ca): MUA HÀNG đủ 7 module con, thứ tự
      // 1-7 khớp sidebar app con (nav.ts). LOYALTY có từ GĐ 223 — giữ vị trí số 3.
      { to: "/m/mua-hang-quy-trinh", label: "Quy trình mua hàng" },
      { to: "/m/mua-hang-bang-gia-vx", label: "Bảng giá Vắc xin" },
      { to: "/m/nhap-loyty", label: "Chương trình LOYALTY" },
      { to: "/m/mua-hang-don-dat", label: "Đơn đặt hàng gửi NCC" },
      { to: "/m/mua-hang-ncc-order", label: "NCC gửi Order" },
      { to: "/m/mua-hang-unc", label: "Lập UNC chuyển tiền" },
      { to: "/m/mua-hang-theo-doi", label: "Theo dõi trạng thái mua hàng" },
    ],
  },
  {
    key: "bh-nhap-ban-hang",
    label: "NHẬP DỮ LIỆU — BÁN HÀNG",
    leaves: [
      { to: "/m/banhang-bang-gia-dich-vu", label: "Bảng giá dịch vụ" },
      { to: "/m/banhang-chuong-trinh-khuyen-mai", label: "Chương trình khuyến mãi" },
      { to: "/m/banhang-th-gbkm-gnck-ln", label: "Bảng TH GB-KM_GN-CK_LN" },
    ],
  },
  {
    key: "banhang-misa",
    label: "DỮ LIỆU TỪ MISAmeInvoice",
    leaves: [
      { to: "/m/misa-hoadon", label: "Bảng kê chi tiết hóa đơn đã sử dụng" },
      { to: "/m/misa-bkth", label: "Bảng kê hóa đơn đã sử dụng" },
      // GĐ 223 (24/09 — yêu cầu Đại ca): nhánh MIA TOOL lồng trong nhóm MISA
      // (quyền nhóm "banhang-misa" điều khiển cả nhánh; 4 lá mới chip riêng).
      { to: "/m/mia-muavao-tongquan", label: "Mua vào - Tổng quan (MiaTool)" },
      { to: "/m/mia-muavao-chitiet", label: "Mua vào - Chi tiết (MiaTool)" },
      { to: "/m/mia-banra-tongquan", label: "Bán ra - Tổng quan (MiaTool)" },
      { to: "/m/mia-banra-chitiet", label: "Bán ra - Chi tiết (MiaTool)" },
      // GĐ 420: 10 lá NHẬP DỮ LIỆU (điều chuyển/LOYALTY/danh mục/banhang-*) đã
      // TÁCH sang 4 nhóm "bh-nhap-*" phía trên — nhóm này còn 2 MISA + 4 MIA.
    ],
  },
  {
    key: "banhang-banhang",
    label: "DỮ LIỆU TỪ SMED - BÁN HÀNG",
    leaves: [
      { to: "/m/smed-hdd", label: "Thống kê tình hình sử dụng HĐĐT" },
      { to: "/m/smed-doanhthu-doituong", label: "Thống kê DT theo đối tượng" },
      { to: "/m/smed-doanhthu-chuoi", label: "Thống kê DT tổng hợp Chuỗi" },
      { to: "/m/smed-chungtu-cuoi-ngay", label: "Bảng kê chung cuối ngày" },
      { to: "/m/smed-dt-blth", label: "Thống kê DT theo ĐT_BLTH" },
    ],
  },
  {
    key: "banhang-kho",
    label: "DỮ LIỆU TỪ SMED - KHO",
    leaves: [
      { to: "/m/kho-nhap", label: "Bảng kê nhập kho" },
      { to: "/m/kho-xuat", label: "Bảng kê xuất kho" },
      { to: "/m/kho-xnt", label: "Báo cáo nhập xuất tồn - Kế toán" },
    ],
  },
  {
    key: "banhang-marketing",
    label: "DỮ LIỆU TỪ SMED - MARKETING",
    leaves: [
      { to: "/m/mkt-chietkhau", label: "Báo cáo chiết khấu" },
      { to: "/m/mkt-hentiem", label: "Lịch hẹn tiêm" },
      { to: "/m/mkt-dattruoc", label: "Gói tiêm - Đặt trước Vắc Xin" },
      // GĐ 228m (26/09/2026) — Thống kê gói và Vắc xin đặt trước (số 4)
      { to: "/m/mkt-tkgvvxdt", label: "Thống kê gói và Vắc xin đặt trước" },
    ],
  },
  {
    key: "bh-bao-cao-ke-toan",
    label: "BÁO CÁO KẾ TOÁN",
    leaves: [
      { to: "/m/bc-cuoi-ngay", label: "Báo cáo cuối ngày - Đối soát HĐ-XK" },
      { to: "/m/bc-truyxuat", label: "Báo cáo Truy xuất - Đối soát" },
      { to: "/m/bc-banhang", label: "Báo cáo bán hàng" },
      { to: "/m/bc-thu-tien", label: "Báo cáo thu tiền" },
      { to: "/m/bc-sd-hddt", label: "Báo cáo tình hình SD-HĐĐT" },
      // GĐ C.77 (24/09/2026 — yêu cầu Đại ca): 2 bảng kê MISA — báo cáo số 6 + 7
      // BÁO CÁO KẾ TOÁN — ĐỒNG BỘ nav.ts repo con.
      { to: "/m/bc-bkct", label: "Bảng kê chi tiết hóa đơn đã sử dụng" },
      { to: "/m/bc-bkth", label: "Bảng kê hóa đơn đã sử dụng" },
      // GĐ 357/C.194 (08/10 — yêu cầu Đại ca, PA-1 chốt): GỘP 2 trang TQ+CT thành
      // 1 trang gộp mỗi báo cáo (TQ TRÊN + CT DƯỚI) — Mua vào + Bán ra; 4 lá cũ xóa.
      { to: "/m/bc-mia-muavao", label: "Bảng kê HĐ GTGT mua vào (MiaTool)" },
      { to: "/m/bc-mia-banra", label: "Bảng kê HĐ GTGT bán ra (MiaTool)" },
      // GĐ 357/C.194: GỘP Chi tiết + Tổng hợp thành 1 trang gộp mỗi ngân hàng
      // (Tổng hợp TRÊN + Chi tiết DƯỚI) — VCB/TCB/TPB; 3 lá -th cũ xóa; VTB giữ nguyên.
      { to: "/m/bc-bank-vcb", label: "Sao kê ngân hàng VCB" },
      { to: "/m/bc-bank-tcb", label: "Sao kê ngân hàng TCB" },
      { to: "/m/bc-bank-tpb", label: "Sao kê ngân hàng TPB" },
      { to: "/m/bc-bank-vtb", label: "BC_Sao kê ngân hàng VTB" },
    ],
  },
  {
    key: "bh-bao-cao-kho",
    label: "BÁO CÁO KHO",
    leaves: [
      // GĐ C.68 (23/09/2026 — yêu cầu Đại ca): thứ tự 1→7 mới + 3 module mới
      // (ma trận nhập/xuất + kiểm kê cuối tháng) — ĐỒNG BỘ nav.ts repo con.
      { to: "/m/bc-nhap-kho", label: "Báo cáo nhập kho" },
      { to: "/m/bc-xuat-kho", label: "Báo cáo xuất kho" },
      { to: "/m/bc-xuat-huy", label: "Báo cáo xuất hủy" },
      { to: "/m/bc-tonkho-luong", label: "Báo cáo tồn kho theo lượng" },
      { to: "/m/bc-nxt-luong", label: "Báo cáo TH_NXT kho theo lượng" },
      { to: "/m/bc-nxt-luong-tien", label: "Báo cáo TH_NXT kho theo lượng-tiền" },
      { to: "/m/bc-kiem-ke", label: "Báo cáo kiểm kê cuối tháng" },
      { to: "/m/bc-matrix-nhap", label: "Báo cáo nhập kho — ma trận theo trung tâm" },
      { to: "/m/bc-matrix-xuat", label: "Báo cáo xuất kho — ma trận theo trung tâm" },
      // GĐ 430 / C.260 (14/10/2026 — yêu cầu Đại ca): Ma trận điều chuyển nội bộ Vắc Xin
      { to: "/m/bc-dieu-chuyen-matrix", label: "Điều chuyển nội bộ — Ma trận tổng hợp" },
    ],
  },
  {
    key: "bh-bao-cao-marketing",
    label: "BÁO CÁO MARKETING",
    leaves: [
      { to: "/m/bc-tiem-ho", label: "Báo cáo tiêm hộ" },
      { to: "/m/bc-chietkhau-th", label: "Báo cáo tổng hợp chiết khấu" },
      { to: "/m/bc-congno-dattruoc", label: "Báo cáo công nợ đặt trước" },
      // GĐ 228o (26/09/2026) — Thống kê gói và VX đặt trước (nguồn 14.GVVXDT tool 32)
      { to: "/m/bc-tkgvvxdt", label: "Thống kê gói và VX đặt trước" },
      { to: "/m/bc-lich-hen", label: "Danh sách lịch hẹn tiêm" },
    ],
  },
  // ============================================================
  // GĐ 438 (14/10/2026 — yêu cầu Đại ca): "BÁO CÁO — XEM CỦA MỌI NGƯỜI" —
  // user ĐƯỢC PHÂN QUYỀN (toggle dưới đây) xem được báo cáo đã tạo của MỌI
  // NGƯỜI như Admin (sqlreport/txds — lịch sử + kết quả), KHÔNG phân biệt
  // Admin/user. CHỈ áp dụng phần XEM báo cáo — không mở hủy/xóa job người khác.
  // Nhóm không có lá (toggle nhóm = công tắc duy nhất). App con đọc trực tiếp
  // key "bh-xem-bao-cao-moi-nguoi" trong module_access (canViewAllReports).
  // ============================================================
  {
    key: "bh-xem-bao-cao-moi-nguoi",
    label: "BÁO CÁO — XEM CỦA MỌI NGƯỜI",
    leaves: [],
  },
  {
    key: "bh-upload-misa-amis",
    label: "UPLOAD - MISA AMIS",
    leaves: [
      { to: "/m/up-hoadon-gtgt", label: "UPLOAD Hóa đơn GTGT bán hàng" },
      { to: "/m/up-nhap-kho", label: "UPLOAD Chứng từ mua hàng" },
      { to: "/m/up-xuat-kho", label: "UPLOAD Phiếu xuất kho" },
      { to: "/m/up-tecombank", label: "UPLOAD Ngân hàng TECOMBANK" },
      { to: "/m/up-tpbank", label: "UPLOAD Ngân hàng TPBANK" },
      { to: "/m/up-hoadon-dauvao", label: "UPLOAD Hóa đơn đầu vào" },
    ],
  },
  // GĐ 504/C.322 (22/10/2026 — yêu cầu Đại ca): nhóm ĐỐI CHIẾU SỐ LIỆU — ngang
  // hàng BÁO CÁO / UPLOAD - MISA AMIS (sidebar app con). Mục 1: Đối chiếu nhập
  // kho MISA ↔ SMED ↔ MIA TOOL (builder dc-nhap-kho agent — 3 khối cột _MS/_SM/_MI).
  {
    key: "bh-doi-chieu-so-lieu",
    label: "ĐỐI CHIẾU SỐ LIỆU",
    leaves: [
      { to: "/m/doi-chieu-nhap-kho", label: "Đối chiếu nhập kho MISA-SMED-MIATOOL" },
    ],
  },
  // GĐ 229 (26/09/2026 — yêu cầu Đại ca): nhóm ĐIỀU HÀNH — NHIỆM VỤ (bậc 0
  // app con). Trước đây /m/tasks hardcode mở cho mọi user có quyền Bán hàng →
  // thiếu phân quyền ở App Tổng. Nay đưa vào BH_GROUPS — nguyên tắc chung:
  // module mới của app con PHẢI thêm nhóm/lá ở đây để cấu hình được.
  {
    key: "bh-dieu-hanh-nhiem-vu",
    label: "ĐIỀU HÀNH — NHIỆM VỤ",
    leaves: [
      { to: "/m/tasks", label: "Nhiệm vụ định kỳ (Task_01 + Task_02)" },
    ],
  },
  // GĐ 253 (29/09/2026 — yêu cầu Đại ca): nhóm DỮ LIỆU TỪ BANK — 4 sao kê
  // ngân hàng (placeholder khung, nội dung download làm khi có tool/nguồn).
  // App con: nav.ts nhánh cuối DOWNLOAD + smed-auth.ts ROUTE_TO_GROUP
  // "banhang-bank" (đồng bộ BH_ALL_GROUP_KEYS).
  {
    key: "banhang-bank",
    label: "DỮ LIỆU TỪ BANK",
    leaves: [
      { to: "/m/bank-vcb", label: "Sao kê ngân hàng VCB" },
      { to: "/m/bank-tcb", label: "Sao kê ngân hàng TCB" },
      { to: "/m/bank-tpb", label: "Sao kê ngân hàng TPB" },
      { to: "/m/bank-vtb", label: "Sao kê ngân hàng VTB" },
    ],
  },
];

/** Mọi key nhóm (15) — dùng vòng for, tránh suy diễn từ mảng literal. */
export const BH_GROUP_KEYS: string[] = BH_GROUPS.map((g) => g.key);

/** Mọi key lá (bh-leaf-*) — phẳng từ BH_GROUPS. */
export const BH_LEAF_KEYS: string[] = BH_GROUPS.flatMap((g) => g.leaves.map((l) => `bh-leaf-${l.to}`));

/**
 * Quyền hiệu lực của employee đối với app con (NHÓM + LÁ) — dùng ở app tổng
 * (trang Phân quyền + sso-token khi ký JWT). Logic backward-compat:
 *   Admin/SuperAdmin → đủ hết.
 *   Chưa bật "banhang" → không nhóm/lá nào (trừ Admin).
 *   Bật "banhang", chưa config nhóm nào → đủ hết (GĐ 108/143 compat).
 *   Bật "banhang", có config nhóm → nhóm nào true = đủ nhóm đó + TẤT CẢ lá của
 *   nhóm đó (quyền lá chỉ dùng để THU HẸP trong nhóm được bật).
 */
export function getBanhangDetailAccess(
  role: string | undefined,
  modules: Record<string, unknown>,
): { groups: Record<string, boolean>; leaves: Record<string, boolean> } {
  const isAdmin = role === "SuperAdmin" || role === "Admin";
  const groups: Record<string, boolean> = {};
  const leaves: Record<string, boolean> = {};

  if (isAdmin) {
    for (const g of BH_GROUPS) {
      groups[g.key] = true;
      for (const l of g.leaves) leaves[`bh-leaf-${l.to}`] = true;
    }
    return { groups, leaves };
  }

  if (modules.banhang !== true) return { groups, leaves };

  const anyConfigured = BH_GROUP_KEYS.some((k) => k in modules);
  if (!anyConfigured) {
    // Chưa cấu hình nhóm nào → đủ hết (backward-compat GĐ 108/143)
    for (const g of BH_GROUPS) {
      groups[g.key] = true;
      for (const l of g.leaves) leaves[`bh-leaf-${l.to}`] = true;
    }
    return { groups, leaves };
  }

  // Có config: nhóm nào bật → lá của nhóm đó bật SẴN; quyền lá "bh-leaf-*"
  // false ghi đè để thu hẹp trong nhóm (chỉ khi đã từng config lá).
  const anyLeafConfigured = BH_LEAF_KEYS.some((k) => k in modules);
  for (const g of BH_GROUPS) {
    const groupOn = modules[g.key] === true;
    groups[g.key] = groupOn;
    for (const l of g.leaves) {
      const leafKey = `bh-leaf-${l.to}`;
      if (!groupOn) {
        leaves[leafKey] = false;
      } else if (anyLeafConfigured && leafKey in modules) {
        leaves[leafKey] = modules[leafKey] === true;
      } else {
        leaves[leafKey] = true; // nhóm bật, lá chưa từng config → theo nhóm
      }
    }
  }
  return { groups, leaves };
}

/**
 * CHECKLIST KHI THÊM NHÓM/BÁO CÁO MỚI (GĐ 199 — bắt buộc; bổ sung GĐ 420):
 * 1. Thêm lá vào BH_GROUPS (file này) — key lá = "bh-leaf-<route>"
 * 2. Thêm lá cùng nhãn vào nav.ts app con (cây sidebar)
 * 3. Map route → nhóm trong smed-auth.ts app con (REPORT_GROUP / SQL_QUERY_GROUP /
 *    ROUTE_TO_GROUP + thêm key nhóm vào BH_ALL_GROUP_KEYS — thiếu ROUTE_TO_GROUP
 *    là BUG: leaf key không sinh → menu app con ẩn + chặn oan user thường, GĐ 420)
 * 4. Map NHÓM BẬC 2 sidebar → key quyền trong components/app-shell.tsx app con
 *    (NAV_GROUP_TO_MOD) — nhóm không map = không ẩn theo nhóm (GĐ 420)
 * 5. Route mới thuộc nhóm quyền nào thì page guard + API guard tự ăn theo —
 *    KHÔNG cần sửa hệ thống phân quyền (UI toggle sinh từ BH_GROUPS).
 */
