-- 0014: Enhance checkins table for full-featured Check-in module.
-- Adds photo, center_code, status, updated_at, deleted_at for offline-first sync.

-- 1. Add new columns
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS photo text default '';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS center_code text default 'VP';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS status text default 'checked_in';
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Backfill updated_at for existing rows
UPDATE checkins SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Indexes for fast queries
CREATE INDEX IF NOT EXISTS checkins_name_idx ON checkins (name);
CREATE INDEX IF NOT EXISTS checkins_center_code_idx ON checkins (center_code);
CREATE INDEX IF NOT EXISTS checkins_status_idx ON checkins (status);
CREATE INDEX IF NOT EXISTS checkins_deleted_at_idx ON checkins (deleted_at) WHERE deleted_at IS NOT NULL;
