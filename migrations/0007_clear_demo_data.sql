-- 0007_clear_demo_data.sql
-- Truncate application demo data tables so Neon contains no demo rows.
-- Generated: 2026-08-28

BEGIN;
TRUNCATE TABLE attendance CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE cash_vouchers CASCADE;
TRUNCATE TABLE proposals CASCADE;
TRUNCATE TABLE notes CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE checkins CASCADE;
COMMIT;
