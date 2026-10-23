-- 0021: Chat nâng cấp kiểu Zalo (GĐ 69)
-- - direct_key: nhắn tin 1-1 ("a|b" = 2 employee ID sort nhau) — NULL nếu kênh nhóm
-- - attachments: đính kèm ảnh/file (URL Cloudinary, JSONB)
-- - created_by: ID employee người gửi (tin cũ fallback từ from_name)
-- - updated_at: LWW offline merge — tin nhắn không sửa được nên gần như luôn = created_at
-- - deleted_at: tombstone thu hồi tin nhắn (soft delete lan truyền mọi thiết bị)
-- Tự chạy khi Vercel build (npm run db:migrate)

alter table messages add column if not exists direct_key text default '';
alter table messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table messages add column if not exists created_by text default '';
alter table messages add column if not exists updated_at timestamptz;
alter table messages add column if not exists deleted_at timestamptz;

-- Backfill: tin cũ = kênh nhóm (direct_key rỗng), người tạo = from_name, updated_at = created_at
update messages
set direct_key = coalesce(direct_key, ''),
    attachments = coalesce(attachments, '[]'::jsonb),
    created_by = coalesce(created_by, ''),
    updated_at = coalesce(updated_at, created_at);

create index if not exists messages_direct_key_idx on messages (direct_key);
create index if not exists messages_created_by_idx on messages (created_by);
