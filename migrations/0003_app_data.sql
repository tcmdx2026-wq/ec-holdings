-- Application data tables for GIONG VN.
-- Migrates all localStorage data to Neon PostgreSQL.

-- 1. Chấm công (Attendance)
create table if not exists attendance (
  id text primary key,
  name text not null,
  status text not null,
  time text not null,
  date text not null,
  weekday text not null,
  gps text default '',
  address text default '',
  photo text,
  type text default 'Bình thường',
  approved text default 'Chưa',
  workplace text default 'VP',
  created_at timestamptz not null default now()
);
create index if not exists attendance_date_idx on attendance (date);
create index if not exists attendance_name_idx on attendance (name);

-- 2. Nhiệm vụ (Tasks)
create table if not exists tasks (
  id text primary key,
  assignee text not null,
  title text not null,
  created text not null,
  due text default '',
  status text not null default 'Việc cần làm',
  support text default '',
  blocker text default '',
  updated text not null,
  created_by text default '',
  created_at timestamptz not null default now()
);
create index if not exists tasks_status_idx on tasks (status);
create index if not exists tasks_assignee_idx on tasks (assignee);

-- 3. Quỹ tiền (Cash vouchers)
create table if not exists cash_vouchers (
  id text primary key,
  type text not null,
  date text not null,
  amount numeric not null default 0,
  content text not null,
  center text default 'VP',
  person text default '',
  method text default 'Chuyển khoản',
  status text not null default 'Nháp',
  created_at timestamptz not null default now()
);
create index if not exists cash_status_idx on cash_vouchers (status);

-- 4. Đề nghị (Proposals)
create table if not exists proposals (
  id text primary key,
  kind text not null,
  title text not null,
  requester text default '',
  date text not null,
  detail text default '',
  status text not null default 'Chờ duyệt',
  dept text default '',
  created_at timestamptz not null default now()
);
create index if not exists proposals_status_idx on proposals (status);

-- 5. Ghi chú (Notes)
create table if not exists notes (
  id text primary key,
  stt text,
  date text not null,
  content text not null,
  author text default '',
  deploy text default '',
  deadline text default '',
  support text default '',
  dept text default '',
  status text default '',
  created_at timestamptz not null default now()
);

-- 6. Tin nhắn (Chat messages)
create table if not exists messages (
  id text primary key,
  from_name text not null,
  text text not null,
  at text not null,
  channel text default 'general',
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_idx on messages (channel);

-- 7. Check-in
create table if not exists checkins (
  id text primary key,
  name text not null,
  time text not null,
  date text not null,
  weekday text not null,
  gps text default '',
  address text default '',
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists checkins_date_idx on checkins (date);
