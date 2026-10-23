-- 0020: Notes — thêm created_by (lọc "Của tôi" theo ID) + updated_at (LWW offline merge)
-- Tự chạy khi Vercel build (npm run db:migrate)

alter table notes add column if not exists created_by text default '';
alter table notes add column if not exists updated_at timestamptz;

-- Backfill: người tạo = author hiện có; updated_at = created_at (bản ghi cũ)
update notes set created_by = coalesce(created_by, ''), updated_at = coalesce(updated_at, created_at);

create index if not exists notes_date_idx on notes (date desc);
create index if not exists notes_created_by_idx on notes (created_by);
