-- 0016_task_assigner.sql
-- Thêm trường `assigner` (người giao nhiệm vụ) vào bảng tasks.
-- Mặc định là `created_by` — người tạo task sẽ được coi là người giao.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigner text;

-- Retroactive fill: nếu assigner vẫn NULL, lấy từ created_by
UPDATE tasks
SET assigner = created_by
WHERE assigner IS NULL;
