-- 0023: Nhóm chat kiểu Zalo (GĐ 72 — chốt của Đại ca)
-- - Chỉ Admin tạo nhóm; Chủ nhóm + Admin thêm thành viên
-- - 4 kênh công khai (Chung/Kế toán/Dược/Marketing) GIỮ NGUYÊN — phòng chat chung công ty
-- - Nhóm riêng: member mới thấy group trong danh sách hội thoại
-- Tự chạy khi Vercel build (npm run db:migrate)

create table if not exists chat_groups (
  id text primary key,
  name text not null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);
create index if not exists chat_groups_created_by_idx on chat_groups (created_by);

create table if not exists chat_group_members (
  group_id text not null references chat_groups(id) on delete cascade,
  employee_id text not null,
  role text not null default 'member', -- 'owner' | 'member'
  added_at timestamptz not null default now(),
  primary key (group_id, employee_id)
);
create index if not exists chat_group_members_employee_idx on chat_group_members (employee_id);

-- Tin nhắn nhóm riêng: group_id = id nhóm (rỗng với kênh công khai + 1-1)
alter table messages add column if not exists group_id text default '';
create index if not exists messages_group_id_idx on messages (group_id);

-- Backfill: tin cũ không thuộc nhóm nào
update messages set group_id = coalesce(group_id, '');
