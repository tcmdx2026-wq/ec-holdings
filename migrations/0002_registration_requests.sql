-- Registration requests table for user approval workflow.
-- When a new user registers, their request is stored here with status "pending".
-- Admin can then approve or reject the request.
-- Only approved users can login to the system.

create table if not exists registration_requests (
  id text primary key,
  name text not null,
  email text not null unique,
  password text not null,
  department text,
  center text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text
);

-- Index for quick lookups by email
create index if not exists registration_requests_email_idx on registration_requests (email);

-- Index for filtering by status
create index if not exists registration_requests_status_idx on registration_requests (status);
