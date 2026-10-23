-- Migration 0029: checkins thêm cột video (GĐ 102 — quay video Check-in)
-- Video quay từ camera trước/sau CÓ đóng dấu (ngày giờ, tên, GPS) — lưu Cloudinary,
-- Neon chỉ lưu URL. Ảnh giữ nguyên cột photo — ảnh + video song song.
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS video text default '';
