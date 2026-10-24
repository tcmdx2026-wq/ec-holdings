# HƯỚNG DẪN CHUYỂN MÁY CHỦ — EC-HOLDINGS

> **Dành cho Đại Ca + AI Agent.** Khi cần chuyển app + dữ liệu sang máy chủ / dịch vụ mới,
> làm theo đúng kịch bản ở phần dưới. Viết GĐ 517 (24/10/2026) — dựa trên kiến trúc thật
> tại thời điểm đó. Nếu kiến trúc đổi, cập nhật file này trước khi chuyển.

---

## PHẦN 1 — BẢN ĐỒ DỮ LIỆU & DỊCH VỤ HIỆN TẠI

| # | Thành phần | Nhà cung cấp | Chứa gì | Cách truy cập |
|---|---|---|---|---|
| 1 | **Database chính** | Neon PostgreSQL (vùng us-east-2) | TẤT CẢ dữ liệu: user/session/account (đăng nhập), employees, centers, attendance, checkins, tasks, proposals, notes, messages, chat_*, documents, registration_requests, module_access, _migrations | `DATABASE_URL` trên Vercel |
| 2 | **Ảnh chấm công/check-in** | Cloudinary (cloud `osevyaag`) | File ảnh thật (DB chỉ lưu URL) | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` |
| 3 | **Backup tự động** | Google Drive — folder "EC-HOLDINGS-Backup" | JSON (khôi phục) + XLSX (đọc) — cron Thứ Hai 09:17 giờ VN | `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` |
| 4 | **Code** | GitHub `tcmdx2026-wq/ec-holdings` | Source + 32 file migration + icon/PWA | Git push/pull |
| 5 | **App chạy** | Vercel (project `ec-holdings`, team `tcmdx2026`) | Build + chạy production, domain `ec-holdings.vercel.app`, cron | Dashboard/API Vercel |
| 6 | **Env vars** | Vercel project | 14 biến (liệt kê Phụ lục A) | vercel env ls |
| 7 | **Máy người dùng** | localStorage + cookie | Cache địa lý, phiên đăng nhập, cache PWA | Không cần chuyển (tự tạo lại) |

**Nguyên tắc vàng:** app **không lưu file dữ liệu trên đĩa server** — DB ở Neon, ảnh ở Cloudinary
→ chỉ cần mang: code (GitHub) + env vars + database (dump) + ảnh (Cloudinary giữ nguyên).

---

## PHẦN 2 — CHUẨN BỊ TRƯỚC KHI CHUYỂN (bắt buộc — làm theo thứ tự)

### 2.1 Backup database Neon (quan trọng nhất)

```bash
# Cần pg_dump 16+ (tải từ https://www.postgresql.org/download/ hoặc dùng máy có sẵn)
# Connection string: Neon Console → project → Dashboard → Connection string (kèm ?sslmode=require)
pg_dump "postgresql://neondb_owner:***@ep-restless-recipe-b5tffdqm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require" \
  --format=custom --file=ec-holdings-full.dump

# (tùy chọn) bản SQL đọc được:
pg_dump "postgresql://...neondb?sslmode=require" --format=plain --file=ec-holdings-full.sql
```

### 2.2 Backup JSON mới nhất từ Drive

- Vào Google Drive → folder **"EC-HOLDINGS-Backup"** → tải file `giong-vn-backup-*.json` mới nhất.
- Hoặc chạy backup ngay: `curl -H "Authorization: Bearer <CRON_SECRET>" https://ec-holdings.vercel.app/api/cron/backup`
- File JSON chứa toàn bộ bảng nghiệp vụ (không gồm user/session — tài khoản đăng nhập
  chỉ có trong pg_dump 2.1).

### 2.3 Xuất danh sách env vars

```bash
npx vercel env ls --scope=tcmdx2026 --project=ec-holdings > env-list.txt
```

Danh sách 14 biến hiện hành (Phụ lục A). **Giá trị sensitive không đọc được qua CLI** —
lưu sẵn bản giá trị vào `.secrets/` (máy này) hoặc chuẩn bị nhập tay.

### 2.4 Kiểm tra quyền truy cập

- [ ] GitHub: quyền admin repo
- [ ] Neon: quyền project (backup + tạo project mới)
- [ ] Cloudinary: API key/secret còn hợp lệ
- [ ] Google Drive: refresh token còn hoạt động (thử chạy backup 1 lần)
- [ ] Vercel (cũ + mới): token/dashbroad

---

## PHẦN 3 — KỊCH BẢN A: CHUYỂN SANG DỊCH VỤ CLOUD KHÁC (dễ nhất, ~1-2 giờ)

Dùng khi: đổi tài khoản Vercel, đổi nhà cung cấp (Render/Railway/Netlify...), tách project.

1. **Tạo DB mới** (Neon khác hoặc Postgres bất kỳ) → ghi connection string mới.
2. **Import dữ liệu:**
   ```bash
   psql "postgresql://user:pass@host-moi/db?sslmode=require" -f ec-holdings-full.sql
   # (hoặc pg_restore nếu dùng format=custom)
   ```
3. **Code:** push repo lên GitHub (repo mới hoặc giữ nguyên — dịch vụ mới kết nối GitHub).
4. **Chạy app mới:** import repo vào dịch vụ → set **đủ 14 env** (Phụ lục A) → build
   (schema tự migrate lần đầu qua `npm run db:migrate` — nếu đã import data thì `_migrations`
   đã có trong dump, migrate bỏ qua).
5. **Domain:** trỏ DNS/subdomain mới → sửa env `BETTER_AUTH_URL` = URL mới → redeploy.
6. **Cloudinary + Google Drive backup:** giữ nguyên tài khoản (không cần chuyển) — chỉ
   nhớ set lại 5 biến GOOGLE_*/CLOUDINARY_* như cũ.
7. **Verify** (Phần 7) → xong mới ngừng app cũ.

---

## PHẦN 4 — KỊCH BẢN B: SELF-HOST MÁY CHỦ RIÊNG (VPS/máy thật — ~nửa ngày + vận hành)

Dùng khi: yêu cầu dữ liệu nội bộ, không muốn phụ thuộc dịch vụ nước ngoài.

### 4.1 Yêu cầu máy

- Linux/Windows Server, Node.js ≥ 20 (app build với Node 24 runtime — khuyến nghị 22+),
  2 vCPU / 4GB RAM là đủ quy mô hiện tại.
- PostgreSQL 16 cài trên máy (hoặc máy DB riêng).
- Tên miền + port 80/443 mở.

### 4.2 Database

```bash
# Cài PostgreSQL, tạo DB:
createdb ec_holdings
# Import từ dump Neon:
pg_restore -d ec_holdings ec-holdings-full.dump   # (hoặc psql -f file.sql)
# Tạo user app + set DATABASE_URL:
# postgresql://echoldings:<pass>@127.0.0.1:5432/ec_holdings
```

### 4.3 App — đổi Nitro preset về node-server

File `vite.config.ts` hiện `preset: "vercel"` (khối nitro) — đổi thành:

```ts
nitro({ preset: "node-server" })
```

Rồi:

```bash
npm install
DATABASE_URL="postgresql://echoldings:***@127.0.0.1:5432/ec_holdings" \
BETTER_AUTH_SECRET="<giữ secret cũ>" \
BETTER_AUTH_URL="https://<domain-mới>" \
APP_JWT_SECRET="<giữ secret cũ>" \
npm run build
# Chạy:
DATABASE_URL="..." BETTER_AUTH_URL="..." APP_JWT_SECRET="..." \
node .output/server/index.mjs   # lắng nghe port 3000
```

Dùng **pm2** để tự chạy lại: `pm2 start .output/server/index.mjs --name ec-holdings && pm2 save`.

### 4.4 HTTPS + reverse proxy (nginx)

```nginx
server {
  listen 443 ssl;
  server_name <domain-mới>;
  ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;   # certbot
  ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

### 4.5 Cron backup (thay Vercel Cron)

Cài cron trên máy (crontab -e) gọi endpoint hoặc chạy script backup — **giữ 4 biến
GOOGLE_*** như cũ (refresh token vẫn hợp lệ, không phụ thuộc máy):

```
17 2 * * 1 curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain-mới>/api/cron/backup >> /var/log/ec-backup.log
```

### 4.6 Ảnh Cloudinary

- **Khuyến nghị: giữ Cloudinary** — không phải chuyển gì, ảnh cũ vẫn hiển thị.
- Nếu bắt buộc về đĩa: tải toàn bộ media (Cloudinary console / API) → sửa
  `src/routes/api/upload.ts` (đổi từ upload Cloudinary sang lưu đĩa/S3) — **phải sửa code**.

### 4.7 Env

Mang đủ 14 env (Phụ lục A). Riêng `VITE_*` có hiệu lực lúc **build** — set trước khi build.

---

## PHẦN 5 — KỊCH BẢN C: CHỈ ĐỔI DOMAIN (giữ nguyên mọi dịch vụ, ~30 phút)

1. Vercel → project → Settings → Domains → **Add** domain mới (mua domain riêng hoặc
   dùng subdomain mới) → Vercel tự cấp SSL.
2. Sửa env `BETTER_AUTH_URL` = `https://<domain-mới>` → **redeploy**.
3. Cập nhật URL mới vào tài liệu (AGENTS.md) + người dùng đăng nhập lại lần đầu.

---

## PHẦN 6 — KHÔI PHỤC DỮ LIỆU TỪ FILE JSON BACKUP (khi cần)

File `giong-vn-backup-*.json` chứa mảng các bảng nghiệp vụ (employees, centers,
attendance, tasks, proposals, notes, messages, chat_*, documents,
registration_requests, module_access). Dùng khi DB trống mới và muốn nạp nhanh
nghiệp vụ (tài khoản đăng nhập phải tạo lại qua app — không nằm trong JSON).

Cách an toàn nhất: viết script đọc JSON → INSERT idempotent (kiểm id tồn tại trước
khi thêm) — nhờ AI Agent viết script cho khớp schema hiện hành lúc khôi phục.
**Không** tự INSERT tay hàng loạt khi schema đã đổi.

---

## PHẦN 7 — CHECKLIST SAU KHI CHUYỂN

- [ ] Mở app → đăng nhập `tcmdx2026@gmail.com` OK
- [ ] Dashboard hiện KPI + dữ liệu chấm công
- [ ] Trang Địa điểm: bản đồ + địa chỉ "Số 68 ngõ 142 đường Cổ Bi..." đúng
- [ ] Check-in: GPS + chụp ảnh → ảnh lên Cloudinary → hiện trong báo cáo
- [ ] Nhiệm vụ / Đề nghị / Nhân sự: danh sách đúng dữ liệu cũ
- [ ] Backup chạy 1 lần: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/backup` → `ok:true` + file mới trên Drive
- [ ] Version góc sidebar đúng (package.json)
- [ ] **NGỪNG app cũ / xóa project cũ** — tránh 2 nơi ghi data khác nhau (quan trọng nhất!)

---

## PHỤ LỤC A — 14 ENV VARS HIỆN HÀNH

| Biến | Dùng cho | Ghi chú |
|---|---|---|
| `DATABASE_URL` | Neon Postgres | Bắt buộc — thiếu → app rơi PGLite (mất data mỗi deploy!) |
| `BETTER_AUTH_URL` | Better Auth | = URL production (https://ec-holdings.vercel.app) |
| `BETTER_AUTH_SECRET` | Better Auth | Secret ký session — đổi → mọi người phải đăng nhập lại |
| `APP_JWT_SECRET` | SSO handoff | |
| `VITE_AUTH_ENABLED` | Bật đăng nhập | `true` |
| `VAPID_SUBJECT` | Web push | `mailto:tcmdx2026@gmail.com` |
| `CLOUDINARY_CLOUD_NAME` | Ảnh | `osevyaag` |
| `CLOUDINARY_API_KEY` | Ảnh | |
| `CLOUDINARY_API_SECRET` | Ảnh | |
| `GOOGLE_CLIENT_ID` | Backup Drive | |
| `GOOGLE_CLIENT_SECRET` | Backup Drive | |
| `GOOGLE_REFRESH_TOKEN` | Backup Drive | Thu hồi: Google Account → Security → Third-party access |
| `GOOGLE_DRIVE_FOLDER_ID` | Backup Drive | Folder "EC-HOLDINGS-Backup" |
| `CRON_SECRET` | Cron backup | Vercel Cron tự gửi Bearer header |

## PHỤ LỤC B — NƠI LƯU THÔNG TIN NHẠY

- `.secrets/` (repo này — **gitignore chặn**, không commit): vercel_token.txt,
  google_account.txt (mật khẩu Google), google_oauth_client_id/secret.txt.
- Vercel: env values (encrypted).
- GĐ liên quan: 463 (PGLite mất data), 103/104 (backup Drive), 470 (kiểm tra trước/sau push),
  516 (bật backup Drive).
