-- 0017: Per-user module access overrides (Phân quyền).
--
-- Before: Admin grants (Phân quyền page) were saved ONLY in the Admin's
-- browser localStorage (`giong-vn-module-access`), so they never applied on
-- other users' devices. This table is the shared source of truth — one row
-- per employee, `modules` = { moduleKey: enabled } overrides on top of the
-- role/department defaults in src/lib/permissions.ts.

create table if not exists module_access (
  employee_id text primary key,
  modules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
