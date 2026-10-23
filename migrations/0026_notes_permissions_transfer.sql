-- 0026: Ghi chú — phân quyền mới + chuyển dữ liệu cũ về Admin
-- Yêu cầu Đại ca 2026-09-12:
--   (1) Chuyển toàn bộ ghi chú hiện có sang Admin (Phạm Kiên Cường — Quản trị HT)
--   (2) Admin xem/sửa/xóa TẤT CẢ; User xem/sửa ghi chú của mình, KHÔNG xóa được
-- Tự chạy khi Vercel build (npm run db:migrate)

-- Tombstone xóa mềm — điều kiện để Admin xóa ghi chú lan truyền mọi thiết bị
alter table notes add column if not exists deleted_at timestamptz;

-- (1) Chuyển sở hữu toàn bộ ghi chú hiện có về Phạm Kiên Cường (Admin — Quản trị HT)
-- Chỉ đụng dòng CHƯA có created_by (data cũ trước khi phân quyền mới) —
-- ghi chú user tạo SAU khi deploy không bị cuốn theo ở lần build lại.
update notes
   set created_by = (select id from employees where lower(email) = 'cuongpk.giong04@gmail.com' limit 1),
       author     = (select name from employees where lower(email) = 'cuongpk.giong04@gmail.com' limit 1)
 where coalesce(created_by, '') = ''
   and (select id from employees where lower(email) = 'cuongpk.giong04@gmail.com' limit 1) is not null;

-- Backfill an toàn: created_by rỗng mà không tìm được Admin → giữ author làm created_by
update notes
   set created_by = author
 where coalesce(created_by, '') = '';
