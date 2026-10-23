-- Core production domain for GIONG VN.
-- This file seeds the foundational multi-site organization model before any
-- operational modules are layered on top.

create table if not exists organizations (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  country text not null default 'VN',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  phone text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists roles (
  id uuid primary key,
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create table if not exists centers (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  short_name text not null,
  city text not null,
  district text,
  address text,
  manager_user_id uuid references users(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists employees (
  id uuid primary key,
  user_id uuid references users(id) on delete set null,
  center_id uuid not null references centers(id) on delete cascade,
  department text not null,
  title text not null,
  gender text,
  phone text,
  hire_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_slug_idx on organizations (slug);
create index if not exists users_org_idx on users (organization_id);
create index if not exists centers_org_idx on centers (organization_id);
create index if not exists employees_center_idx on employees (center_id);
create index if not exists employees_user_idx on employees (user_id);

insert into organizations (id, name, slug, country, status)
values ('11111111-1111-1111-1111-111111111111', 'GIONG VN', 'giong-vn', 'VN', 'active')
on conflict (slug) do nothing;

insert into roles (id, name, description)
values
  ('22222222-2222-2222-2222-222222222221', 'super_admin', 'Toàn quyền quản trị hệ thống'),
  ('22222222-2222-2222-2222-222222222222', 'admin', 'Quản trị cấp doanh nghiệp'),
  ('22222222-2222-2222-2222-222222222223', 'regional_manager', 'Quản lý khu vực / đa trung tâm'),
  ('22222222-2222-2222-2222-222222222224', 'center_manager', 'Quản lý trung tâm'),
  ('22222222-2222-2222-2222-222222222225', 'hr', 'Nhân sự'),
  ('22222222-2222-2222-2222-222222222226', 'accountant', 'Kế toán'),
  ('22222222-2222-2222-2222-222222222227', 'warehouse', 'Kho / dược / nhập xuất'),
  ('22222222-2222-2222-2222-222222222228', 'staff', 'Nhân viên vận hành')
on conflict (name) do nothing;

-- Seed the operating network without creating any auth credentials.
-- This keeps auth disabled by default while aligning the platform to the real
-- organizational structure already used in the app catalog.
insert into centers (
  id,
  organization_id,
  code,
  name,
  short_name,
  city,
  district,
  address,
  manager_user_id,
  status
)
values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'VP', 'Văn phòng Công ty Gióng Việt Nam', 'Văn phòng', 'Hà Nội', 'Long Biên', 'Số 1, đường ...', null, 'active'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'LB', 'Trung tâm tiêm chủng Gióng Long Biên', 'Long Biên', 'Hà Nội', 'Long Biên', 'Long Biên, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'SĐ', 'Trung tâm tiêm chủng Gióng Sài Đồng', 'Sài Đồng', 'Hà Nội', 'Long Biên', 'Sài Đồng, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333334', '11111111-1111-1111-1111-111111111111', 'NL', 'Trung tâm tiêm chủng Gióng Ngọc Lâm', 'Ngọc Lâm', 'Hà Nội', 'Long Biên', 'Ngọc Lâm, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333335', '11111111-1111-1111-1111-111111111111', 'TO', 'Trung tâm tiêm chủng Gióng Thanh Oai', 'Thanh Oai', 'Hà Nội', 'Thanh Oai', 'Thanh Oai, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333336', '11111111-1111-1111-1111-111111111111', 'QO', 'Trung tâm tiêm chủng Gióng Quốc Oai', 'Quốc Oai', 'Hà Nội', 'Quốc Oai', 'Quốc Oai, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333337', '11111111-1111-1111-1111-111111111111', 'BH', 'Trung tâm tiêm chủng Gióng Bích Hòa', 'Bích Hòa', 'Hà Nội', 'Thanh Oai', 'Bích Hòa, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333338', '11111111-1111-1111-1111-111111111111', 'ML', 'Trung tâm tiêm chủng Gióng Mê Linh', 'Mê Linh', 'Hà Nội', 'Mê Linh', 'Mê Linh, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333339', '11111111-1111-1111-1111-111111111111', 'TP', 'Trung tâm tiêm chủng Gióng Tiền Phong', 'Tiền Phong', 'Hà Nội', 'Mê Linh', 'Tiền Phong, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333340', '11111111-1111-1111-1111-111111111111', 'CĐ', 'Trung tâm tiêm chủng Gióng Chi Đông', 'Chi Đông', 'Hà Nội', 'Mê Linh', 'Chi Đông, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333341', '11111111-1111-1111-1111-111111111111', 'TĐ', 'Trung tâm tiêm chủng Gióng Thạch Đà', 'Thạch Đà', 'Hà Nội', 'Mê Linh', 'Thạch Đà, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333342', '11111111-1111-1111-1111-111111111111', 'LM', 'Trung tâm tiêm chủng Gióng Liên Mạc', 'Liên Mạc', 'Hà Nội', 'Bắc Từ Liêm', 'Liên Mạc, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333343', '11111111-1111-1111-1111-111111111111', 'TA', 'Trung tâm tiêm chủng Gióng Tâm An', 'Tâm An', 'Hà Nội', 'Hà Nội', 'Tâm An, Hà Nội', null, 'active'),
  ('33333333-3333-3333-3333-333333333344', '11111111-1111-1111-1111-111111111111', 'PY', 'Trung tâm tiêm chủng Gióng Phúc Yên', 'Phúc Yên', 'Vĩnh Phúc', 'Phúc Yên', 'Phúc Yên, Vĩnh Phúc', null, 'active'),
  ('33333333-3333-3333-3333-333333333345', '11111111-1111-1111-1111-111111111111', 'ĐX', 'Trung tâm tiêm chủng Gióng Đồng Xuân', 'Đồng Xuân', 'Vĩnh Phúc', 'Vĩnh Phúc', 'Đồng Xuân, Vĩnh Phúc', null, 'active'),
  ('33333333-3333-3333-3333-333333333346', '11111111-1111-1111-1111-111111111111', 'TS', 'Trung tâm tiêm chủng Gióng Từ Sơn', 'Từ Sơn', 'Bắc Ninh', 'Từ Sơn', 'Từ Sơn, Bắc Ninh', null, 'active'),
  ('33333333-3333-3333-3333-333333333347', '11111111-1111-1111-1111-111111111111', 'HM', 'Trung tâm tiêm chủng Gióng Hương Mạc', 'Hương Mạc', 'Bắc Ninh', 'Từ Sơn', 'Hương Mạc, Bắc Ninh', null, 'active'),
  ('33333333-3333-3333-3333-333333333348', '11111111-1111-1111-1111-111111111111', 'TD', 'Trung tâm tiêm chủng Gióng Tiên Du', 'Tiên Du', 'Bắc Ninh', 'Tiên Du', 'Tiên Du, Bắc Ninh', null, 'active'),
  ('33333333-3333-3333-3333-333333333349', '11111111-1111-1111-1111-111111111111', 'ĐY', 'Trung tâm tiêm chủng Gióng Đông Yên', 'Đông Yên', 'Bắc Ninh', 'Bắc Ninh', 'Đông Yên, Bắc Ninh', null, 'active'),
  ('33333333-3333-3333-3333-333333333350', '11111111-1111-1111-1111-111111111111', 'TT', 'Trung tâm tiêm chủng Gióng Thanh Thùy', 'Thanh Thùy', 'Hà Nội', 'Hà Nội', 'Thanh Thùy, Hà Nội', null, 'active')
on conflict (organization_id, code) do nothing;

insert into employees (
  id,
  user_id,
  center_id,
  department,
  title,
  gender,
  phone,
  hire_date,
  status
)
values
  ('44444444-4444-4444-4444-444444444401', null, '33333333-3333-3333-3333-333333333331', 'Ban giám đốc', 'Giám đốc', 'Nữ', '0902267486', '2024-01-15', 'active'),
  ('44444444-4444-4444-4444-444444444402', null, '33333333-3333-3333-3333-333333333331', 'Ban giám đốc', 'Phó giám đốc', 'Nam', null, '2023-06-01', 'active'),
  ('44444444-4444-4444-4444-444444444403', null, '33333333-3333-3333-3333-333333333331', 'Quản lý', 'Quản trị hệ thống', 'Nam', '0904075757', '2023-09-10', 'active'),
  ('44444444-4444-4444-4444-444444444404', null, '33333333-3333-3333-3333-333333333331', 'Hệ thống', 'Chuyên gia lập trình', 'Nam', '0904075757', '2024-03-11', 'active'),
  ('44444444-4444-4444-4444-444444444405', null, '33333333-3333-3333-3333-333333333331', 'Kế toán', 'Kế toán trưởng', 'Nam', '0826861379', '2023-02-20', 'active'),
  ('44444444-4444-4444-4444-444444444406', null, '33333333-3333-3333-3333-333333333331', 'Hành chính - Nhân sự', 'Trưởng phòng HCNS', 'Nữ', '0327451134', '2022-11-02', 'active'),
  ('44444444-4444-4444-4444-444444444407', null, '33333333-3333-3333-3333-333333333331', 'Marketing', 'Nhân viên Marketing', 'Nữ', null, '2024-06-05', 'active'),
  ('44444444-4444-4444-4444-444444444408', null, '33333333-3333-3333-3333-333333333331', 'Marketing', 'Trưởng phòng Marketing', 'Nữ', null, '2022-08-18', 'active'),
  ('44444444-4444-4444-4444-444444444409', null, '33333333-3333-3333-3333-333333333331', 'Kế toán', 'Kế toán viên', 'Nữ', '0388573597', '2023-12-11', 'active'),
  ('44444444-4444-4444-4444-444444444410', null, '33333333-3333-3333-3333-333333333331', 'Kho', 'Thủ kho', 'Nữ', null, '2023-04-22', 'active'),
  ('44444444-4444-4444-4444-444444444411', null, '33333333-3333-3333-3333-333333333331', 'Dược', 'Quản lý dược', 'Nữ', '0327045684', '2022-10-15', 'active'),
  ('44444444-4444-4444-4444-444444444412', null, '33333333-3333-3333-3333-333333333331', 'Hành chính - Nhân sự', 'Nhân viên HCNS', 'Nữ', '0336365636', '2023-05-10', 'active'),
  ('44444444-4444-4444-4444-444444444413', null, '33333333-3333-3333-3333-333333333331', 'Hành chính - Nhân sự', 'Nhân viên', 'Nam', null, '2023-07-08', 'active'),
  ('44444444-4444-4444-4444-444444444414', null, '33333333-3333-3333-3333-333333333332', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2024-02-11', 'active'),
  ('44444444-4444-4444-4444-444444444415', null, '33333333-3333-3333-3333-333333333333', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2023-08-24', 'active'),
  ('44444444-4444-4444-4444-444444444416', null, '33333333-3333-3333-3333-333333333334', 'Thu ngân', 'Thu ngân', 'Nữ', null, '2024-03-06', 'active'),
  ('44444444-4444-4444-4444-444444444417', null, '33333333-3333-3333-3333-333333333346', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2023-11-12', 'active'),
  ('44444444-4444-4444-4444-444444444418', null, '33333333-3333-3333-3333-333333333349', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2024-01-17', 'active'),
  ('44444444-4444-4444-4444-444444444419', null, '33333333-3333-3333-3333-333333333338', 'Thu ngân', 'Thu ngân', 'Nữ', null, '2023-09-18', 'active'),
  ('44444444-4444-4444-4444-444444444420', null, '33333333-3333-3333-3333-333333333340', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2023-10-16', 'active'),
  ('44444444-4444-4444-4444-444444444421', null, '33333333-3333-3333-3333-333333333344', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2024-02-01', 'active'),
  ('44444444-4444-4444-4444-444444444422', null, '33333333-3333-3333-3333-333333333345', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2024-05-13', 'active'),
  ('44444444-4444-4444-4444-444444444423', null, '33333333-3333-3333-3333-333333333337', 'Hành chính', 'Nhân viên', 'Nam', null, '2023-07-27', 'active'),
  ('44444444-4444-4444-4444-444444444424', null, '33333333-3333-3333-3333-333333333338', 'Hành chính', 'Nhân viên', 'Nam', null, '2023-12-18', 'active'),
  ('44444444-4444-4444-4444-444444444425', null, '33333333-3333-3333-3333-333333333339', 'Thu ngân', 'Thu ngân', 'Nữ', null, '2023-11-22', 'active'),
  ('44444444-4444-4444-4444-444444444426', null, '33333333-3333-3333-3333-333333333347', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2024-01-24', 'active'),
  ('44444444-4444-4444-4444-444444444427', null, '33333333-3333-3333-3333-333333333348', 'Hành chính', 'Nhân viên', 'Nam', null, '2024-02-07', 'active'),
  ('44444444-4444-4444-4444-444444444428', null, '33333333-3333-3333-3333-333333333350', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2023-06-20', 'active'),
  ('44444444-4444-4444-4444-444444444429', null, '33333333-3333-3333-3333-333333333343', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2024-03-29', 'active'),
  ('44444444-4444-4444-4444-444444444430', null, '33333333-3333-3333-3333-333333333350', 'Thu ngân', 'Thu ngân', 'Nữ', null, '2023-05-14', 'active'),
  ('44444444-4444-4444-4444-444444444431', null, '33333333-3333-3333-3333-333333333332', 'Tiêm chủng', 'Điều dưỡng', 'Nữ', null, '2024-04-17', 'active'),
  ('44444444-4444-4444-4444-444444444432', null, '33333333-3333-3333-3333-333333333331', 'Ban giám đốc', 'Quản trị hệ thống', 'Nam', '0904075757', '2024-05-04', 'active')
on conflict (id) do nothing;