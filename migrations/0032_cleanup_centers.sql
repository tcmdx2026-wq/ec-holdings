-- Migration 0032: Cleanup centers - keep only VP (head office)
-- Created: 2026-10-23
-- Purpose: Remove all 19 GIONG VN vaccination centers, keep only EC-HOLDINGS head office

-- Delete centers that are not VP (head office)
DELETE FROM centers
WHERE code != 'VP';

-- Verify remaining centers
SELECT code, name, short_name, city, kind, status
FROM centers
ORDER BY code;