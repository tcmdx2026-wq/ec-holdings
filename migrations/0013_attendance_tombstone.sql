-- Tombstone for attendance — soft delete so removals sync across devices
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index for fast lookup of tombstoned rows
CREATE INDEX IF NOT EXISTS idx_attendance_deleted_at ON attendance (deleted_at) WHERE deleted_at IS NOT NULL;