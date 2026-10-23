-- 0018: Enhance proposals table for full-featured "Đề nghị — Đề xuất" module.
-- Thêm người duyệt, ngày duyệt, người tạo (ID), updated_at (LWW), deleted_at (tombstone),
-- attachments (mảng JSON chứa URL Cloudinary).

-- 1. Thêm cột mới
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approver text default '';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS created_by text default '';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS attachments jsonb default '[]'::jsonb;

-- 2. Backfill: updated_at = date (ngày tạo) cho các dòng cũ; created_by tạm = requester
UPDATE proposals SET updated_at = COALESCE(updated_at, date::timestamptz) WHERE updated_at IS NULL;
UPDATE proposals SET created_by = requester WHERE created_by = '' OR created_by IS NULL;

-- 3. Index tra cứu nhanh
CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals (status);
CREATE INDEX IF NOT EXISTS proposals_requester_idx ON proposals (requester);
CREATE INDEX IF NOT EXISTS proposals_created_by_idx ON proposals (created_by);
CREATE INDEX IF NOT EXISTS proposals_deleted_at_idx ON proposals (deleted_at) WHERE deleted_at IS NOT NULL;
