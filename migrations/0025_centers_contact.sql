-- 0025: Trung tâm — thêm thông tin liên hệ / phụ trách / ghi chú
-- Cột mới trang /trung-tam (2026-09-10):
--   phone   — Số điện thoại trung tâm (Admin điền sau)
--   manager — Tên nhân sự phụ trách trung tâm (Admin điền sau, dropdown chọn từ nhân sự)
--   note    — Ghi chú
-- Manager lưu TÊN hiển thị (không FK) — đồng bộ với pattern `center`/`assignee` lưu tên
-- trong các module khác; đổi tên nhân sự không vỡ khóa ngoại.

alter table centers add column if not exists phone text default '';
alter table centers add column if not exists manager text default '';
alter table centers add column if not exists note text default '';

-- Đảm bảo các trung tâm mặc định có giá trị rỗng (không null)
update centers set phone = coalesce(phone, ''), manager = coalesce(manager, ''), note = coalesce(note, '');
