-- 0024: @mention trong tin nhắn nhóm (GĐ 77 — yêu cầu Đại ca 2026-09-10)
-- - Tin nhóm có thể tag @Tên người → lưu mảng employeeId vào cột mentions (JSONB)
-- - Tin vẫn hiện trong nhóm; người bị tag thấy tên mình tô đậm trong bubble
-- Tự chạy khi Vercel build (npm run db:migrate)

alter table messages add column if not exists mentions jsonb default '[]'::jsonb;

-- Backfill: tin cũ không có mention
update messages set mentions = coalesce(mentions, '[]'::jsonb);
