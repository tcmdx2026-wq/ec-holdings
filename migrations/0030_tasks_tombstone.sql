-- 0030_tasks_tombstone.sql (GĐ 170 — đồng bộ xóa Nhiệm vụ offline-first)
-- Bảng tasks là collection CHÍNH cuối cùng chưa có tombstone (attendance 0013,
-- checkins 0014, proposals 0018, documents 0019, notes 0026, messages 0021 đã có).
-- Xóa vật lý (DELETE FROM) không lan truyền được trong offline-first —
-- record "hồi sinh" trên thiết bị khác khi merge LWW từ local cũ.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks (deleted_at) WHERE deleted_at IS NOT NULL;
