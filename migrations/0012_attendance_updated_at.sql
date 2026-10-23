-- Add updated_at to attendance for Offline-First LWW conflict resolution
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing records: use created_at as initial updated_at
UPDATE attendance SET updated_at = created_at WHERE updated_at = created_at;
