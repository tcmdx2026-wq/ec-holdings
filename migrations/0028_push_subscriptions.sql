-- Migration 0028: Bảng push_subscriptions cho Web Push (GĐ 100 — App Icon Badge)
-- Lưu subscription Push của từng thiết bị (endpoint duy nhất mỗi thiết bị).
-- Badge icon màn hình chính hiện SỐ = tin chat chưa đọc + đề nghị chờ duyệt,
-- cập nhật cả khi app đóng (server gửi push qua VAPID).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  employee_id text NOT NULL DEFAULT '',
  employee_name text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON push_subscriptions(employee_id);
