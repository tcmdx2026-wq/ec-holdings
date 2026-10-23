-- Migration 0015: Thêm columns photo và location vào tasks table
-- Supporting fields for task management

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS photo text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location text default '';
