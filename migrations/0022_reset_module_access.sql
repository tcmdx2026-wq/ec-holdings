-- 0022: Reset toàn bộ override phân quyền (GĐ 71 — chốt của Đại ca)
--
-- Từ nay quyền MẶC ĐỊNH của mọi nhân sự = FULL quyền mọi module trong bảng
-- Phân quyền, TRỪ "Preview Mobile" (chỉ Admin) — xem getDefaultModuleAccess()
-- trong src/lib/permissions.ts (đổi cùng commit này).
--
-- Override cũ trong module_access (một số user bị hạn chế theo bộ phận) bị XÓA
-- để mọi người nhận default mới. Trang Phân quyền vẫn bật/tắt per-user như cũ —
-- lần bật/tắt sau sẽ ghi lại override mới.
--
-- "Phân quyền" + "Duyệt đăng ký" (module 'admin') KHÔNG nằm trong bảng này:
-- mặc định chỉ SuperAdmin/Admin (isAdminRole) — giữ nguyên theo yêu cầu.
--
-- Tự chạy khi Vercel build (npm run db:migrate).

delete from module_access;
