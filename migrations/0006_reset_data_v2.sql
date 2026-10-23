-- Reset all app data tables (second pass)
-- The first TRUNCATE (0005) ran, but old seed data re-seeded into Neon
-- before the code was updated to clear seed files.

TRUNCATE TABLE attendance CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE cash_vouchers CASCADE;
TRUNCATE TABLE proposals CASCADE;
TRUNCATE TABLE notes CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE checkins CASCADE;
