-- 0027: Chat kiểu Zalo — reaction, trả lời, chuyển tiếp, ghim, đánh dấu, xóa phía tôi
-- Yêu cầu Đại ca 2026-09-12 (áp dụng cả NHÓM + 1-1):
--   (1) Reaction cảm xúc tin nhắn (6 quick emoji như Zalo)
--   (2) 3 nút nhanh: Trả lời · Chuyển tiếp · ... (lựa chọn thêm)
--   (3) Menu ...: Copy · Ghim · Đánh dấu · Chọn nhiều · Xem chi tiết · Xóa chỉ ở phía tôi
-- Tự chạy khi Vercel build (npm run db:migrate)

alter table messages add column if not exists reactions jsonb default '[]';
alter table messages add column if not exists reply_to_id text default '';
alter table messages add column if not exists forwarded_from text default '';
alter table messages add column if not exists pinned boolean default false;
alter table messages add column if not exists pinned_by text default '';
alter table messages add column if not exists starred_by jsonb default '[]';
alter table messages add column if not exists deleted_by jsonb default '[]';

-- Backfill tin cũ (an toàn khi chạy lại — coalesce dòng có NULL)
update messages set
  reactions     = coalesce(reactions,     '[]'::jsonb),
  starred_by    = coalesce(starred_by,    '[]'::jsonb),
  deleted_by    = coalesce(deleted_by,    '[]'::jsonb),
  reply_to_id   = coalesce(reply_to_id,   ''),
  forwarded_from = coalesce(forwarded_from, ''),
  pinned_by     = coalesce(pinned_by,     '')
where reactions is null or starred_by is null or deleted_by is null
   or reply_to_id is null or forwarded_from is null or pinned_by is null;

create index if not exists messages_reply_to_idx on messages (reply_to_id);
create index if not exists messages_pinned_idx on messages (pinned) where pinned;
