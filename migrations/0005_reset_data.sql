-- Reset all app data tables (keep schema, delete rows)
-- This ensures a clean slate — data will be re-seeded from JSON on first load.

TRUNCATE TABLE attendance CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE cash_vouchers CASCADE;
TRUNCATE TABLE proposals CASCADE;
TRUNCATE TABLE notes CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE checkins CASCADE;
