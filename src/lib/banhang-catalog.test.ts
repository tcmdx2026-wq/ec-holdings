// GĐ 420 (13/10/2026) — Unit test catalog phân quyền app con (logic THUẦN — chạy
// node --experimental-strip-types). Mục đích: chứng minh 4 nhóm NHẬP DỮ LIỆU mới
// (bh-nhap-*) tách khỏi banhang-misa ĐÚNG cấu trúc cây sidebar app con + quyền
// hiệu lực (getBanhangDetailAccess) hoạt động đúng mọi nhánh compat:
//   Admin đủ hết · chưa bật banhang → rỗng · bật chưa config → đủ hết ·
//   bật + config nhóm → chỉ nhóm đó (lá các nhóm khác false).
// Chạy: node --experimental-strip-types --test src/lib/banhang-catalog.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BH_GROUPS, BH_GROUP_KEYS, BH_LEAF_KEYS, getBanhangDetailAccess } from "./banhang-catalog.ts";

const groupOf = (key: string) => BH_GROUPS.find((g) => g.key === key);
const routesOf = (key: string) => (groupOf(key)?.leaves ?? []).map((l) => l.to);

test("GĐ 420 — cấu trúc: 16 nhóm, 4 nhóm NHẬP DỮ LIỆU đúng số lá, banhang-misa còn 6 lá", () => {
  assert.equal(BH_GROUPS.length, 16, "phải có đủ 16 nhóm (10 cũ + 4 nhập dữ liệu + 1 GĐ 438 + 1 ĐỐI CHIẾU GĐ 504)");
  assert.equal(new Set(BH_GROUP_KEYS).size, 16, "key nhóm không được trùng");
  assert.deepEqual(routesOf("bh-nhap-danh-muc"), [
    "/m/danh-muc-vac-xin",
    "/m/danh-muc-nha-cung-cap",
    "/m/danh-muc-trung-tam",
    "/m/danh-muc-khach-hang",
    // GĐ 447/C.274: 3 danh mục MISA (Kho · Vị trí · Mã thống kê)
    "/m/danh-muc-kho",
    "/m/danh-muc-vi-tri",
    "/m/danh-muc-ma-thong-ke",
    "/m/danh-muc-khac",
  ]);
  assert.deepEqual(routesOf("bh-nhap-kho-hang"), ["/m/nhap-dieu-chuyen"]);
  // GĐ 429 (14/10 — yêu cầu Đại ca): MUA HÀNG từ 1 lá (LOYALTY) → 7 module con,
  // đúng thứ tự sidebar app con 1-7 (nav.ts NHAP_MUA_HANG_LEAFS).
  assert.deepEqual(routesOf("bh-nhap-mua-hang"), [
    "/m/mua-hang-quy-trinh",
    "/m/mua-hang-bang-gia-vx",
    "/m/nhap-loyty",
    "/m/mua-hang-don-dat",
    "/m/mua-hang-ncc-order",
    "/m/mua-hang-unc",
    "/m/mua-hang-theo-doi",
  ]);
  assert.deepEqual(routesOf("bh-nhap-ban-hang"), [
    "/m/banhang-bang-gia-dich-vu",
    "/m/banhang-chuong-trinh-khuyen-mai",
    "/m/banhang-th-gbkm-gnck-ln",
  ]);
  // banhang-misa đã TÁCH 10 lá nhập dữ liệu → chỉ còn 2 MISA + 4 MIA TOOL
  assert.deepEqual(routesOf("banhang-misa"), [
    "/m/misa-hoadon",
    "/m/misa-bkth",
    "/m/mia-muavao-tongquan",
    "/m/mia-muavao-chitiet",
    "/m/mia-banra-tongquan",
    "/m/mia-banra-chitiet",
  ]);
  // GĐ 504/C.322 (22/10 — yêu cầu Đại ca): nhóm ĐỐI CHIẾU SỐ LIỆU — mục 1 nhập kho
  assert.deepEqual(routesOf("bh-doi-chieu-so-lieu"), ["/m/doi-chieu-nhap-kho"]);
});

test("GĐ 420 — mọi lá chỉ thuộc MỘT nhóm duy nhất (không route trùng giữa nhóm)", () => {
  const all = BH_GROUPS.flatMap((g) => g.leaves.map((l) => l.to));
  assert.equal(all.length, BH_LEAF_KEYS.length);
  assert.equal(new Set(all).size, all.length, "route bị lặp giữa 2 nhóm");
});

test("GĐ 420 — Admin: đủ 16 nhóm + mọi lá (kể cả 10 lá NHẬP DỮ LIỆU)", () => {
  const { groups, leaves } = getBanhangDetailAccess("Admin", {});
  for (const k of BH_GROUP_KEYS) assert.equal(groups[k], true, `nhóm ${k} phải bật`);
  for (const k of BH_LEAF_KEYS) assert.equal(leaves[k], true, `lá ${k} phải bật`);
  assert.equal(leaves["bh-leaf-/m/danh-muc-vac-xin"], true);
  assert.equal(leaves["bh-leaf-/m/banhang-th-gbkm-gnck-ln"], true);
});

test("GĐ 438 — nhóm XEM BÁO CÁO CỦA MỌI NGƯỜI: không lá, toggle hoạt động đúng mọi nhánh", () => {
  // cấu trúc: nhóm tồn tại, KHÔNG có lá (toggle duy nhất trên trang Phân quyền)
  assert.deepEqual(routesOf("bh-xem-bao-cao-moi-nguoi"), []);
  // Admin → luôn bật
  assert.equal(getBanhangDetailAccess("Admin", {}).groups["bh-xem-bao-cao-moi-nguoi"], true);
  // chưa bật banhang → tắt
  assert.equal(getBanhangDetailAccess("User", {}).groups["bh-xem-bao-cao-moi-nguoi"], undefined);
  // bật banhang chưa config nhóm → đủ hết (compat) → bật
  assert.equal(getBanhangDetailAccess("User", { banhang: true }).groups["bh-xem-bao-cao-moi-nguoi"], true);
  // có config nhóm khác (chỉ KHO) → CHƯA bật nhóm này → tắt (chủ đích: Admin bật tường minh)
  assert.equal(
    getBanhangDetailAccess("User", { banhang: true, "banhang-kho": true }).groups["bh-xem-bao-cao-moi-nguoi"],
    false,
  );
  // Admin bật tường minh → bật
  assert.equal(
    getBanhangDetailAccess("User", { banhang: true, "banhang-kho": true, "bh-xem-bao-cao-moi-nguoi": true })
      .groups["bh-xem-bao-cao-moi-nguoi"],
    true,
  );
});

test("GĐ 420 — chưa bật banhang: không nhóm, không lá", () => {
  const { groups, leaves } = getBanhangDetailAccess("User", {});
  assert.equal(Object.values(groups).length, 0);
  assert.equal(Object.values(leaves).length, 0);
});

test("GĐ 420 — bật banhang chưa config nhóm: đủ hết (backward-compat GĐ 108/143)", () => {
  const { groups, leaves } = getBanhangDetailAccess("User", { banhang: true });
  for (const k of BH_GROUP_KEYS) assert.equal(groups[k], true);
  assert.equal(leaves["bh-leaf-/m/danh-muc-khac"], true);
});

test("GĐ 420 — bật + config CHỈ nhóm nhập dữ liệu DANH MỤC: 5 lá danh mục bật, nhóm khác tắt", () => {
  const { groups, leaves } = getBanhangDetailAccess("User", { banhang: true, "bh-nhap-danh-muc": true });
  assert.equal(groups["bh-nhap-danh-muc"], true);
  assert.equal(leaves["bh-leaf-/m/danh-muc-vac-xin"], true);
  assert.equal(leaves["bh-leaf-/m/danh-muc-khac"], true);
  // nhóm không bật → lá của nó TẮT dù trước đây nằm chung banhang-misa
  assert.equal(groups["bh-nhap-kho-hang"], false);
  assert.equal(leaves["bh-leaf-/m/nhap-dieu-chuyen"], false);
  assert.equal(leaves["bh-leaf-/m/banhang-bang-gia-dich-vu"], false);
  assert.equal(groups["banhang-misa"], false);
  assert.equal(leaves["bh-leaf-/m/misa-hoadon"], false);
});

test("GĐ 420 — user cũ chỉ có quyền MISA: lá MISA còn, 10 lá NHẬP DỮ LIỆU KHÔNG còn theo", () => {
  const { groups, leaves } = getBanhangDetailAccess("User", { banhang: true, "banhang-misa": true });
  assert.equal(leaves["bh-leaf-/m/misa-hoadon"], true);
  assert.equal(leaves["bh-leaf-/m/mia-muavao-tongquan"], true);
  // đã tách nhóm → phải được Admin bật lại 4 nhóm mới mới thấy (chủ đích GĐ 420)
  assert.equal(leaves["bh-leaf-/m/danh-muc-vac-xin"], false);
  assert.equal(leaves["bh-leaf-/m/nhap-loyty"], false);
});

test("GĐ 420 — config lá nhưng nhóm chưa bật → lá không hiệu lực (UI luôn bật nhóm kèm)", () => {
  const { leaves } = getBanhangDetailAccess("User", {
    banhang: true,
    "banhang-misa": true,
    "bh-leaf-/m/danh-muc-vac-xin": true,
  });
  // có config lá → lá không config trong nhóm bật = theo nhóm; nhóm bh-nhap-danh-muc CHƯA bật
  assert.equal(leaves["bh-leaf-/m/danh-muc-vac-xin"], false, "nhóm chưa bật → lá bật cũng không hiệu lực");
  assert.equal(leaves["bh-leaf-/m/misa-hoadon"], true);
});
