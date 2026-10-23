-- Migration 0031: Cleanup employees - keep only admin (tcmdx2026@gmail.com)
-- Created: 2026-10-23
-- Purpose: Remove all GIONG VN vaccination center employees, keep only EC-HOLDINGS admin

-- Delete employees that are not the admin (tcmdx2026@gmail.com)
DELETE FROM employees
WHERE email != 'tcmdx2026@gmail.com'
  OR email IS NULL;

-- Verify remaining employees
SELECT id, name, username, email, role, center, status
FROM employees
ORDER BY name;