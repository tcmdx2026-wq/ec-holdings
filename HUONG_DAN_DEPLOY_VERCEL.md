# 🚀 Hướng dẫn Deploy GIONG VIỆT NAM lên Vercel

## Tổng quan

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Deployment                     │
├─────────────────────────────────────────────────────────┤
│  Frontend (React)  ←→  Backend (API)  ←→  Neon DB      │
│  - SSR/CSR          - Server Functions   - PostgreSQL   │
│  - PWA               - Auth (Better Auth) - Persistent  │
│  - Tailwind          - CRUD operations     - Free tier   │
└─────────────────────────────────────────────────────────┘
```

---

## Bước 1: Chuẩn bị tài khoản

### 1.1 Tạo tài khoản Vercel (miễn phí)
1. Vào **https://vercel.com**
2. Bấm **"Sign Up"** → chọn **"Continue with GitHub"**
3. Hoàn tất đăng ký

### 1.2 Tạo tài khoản Neon (PostgreSQL miễn phí)
1. Vào **https://neon.tech**
2. Bấm **"Sign Up"** → chọn **"Continue with GitHub"**
3. Tạo project mới:
   - Database name: `giong-vn`
   - Region: **Southeast Asia (Singapore)** - gần Việt Nam nhất
4. Copy **Connection string** (kiểu: `postgresql://...@ep-xxx.us-east-2.aws.neon.tech/giong-vn?sslmode=require`)

### 1.3 Tạo tài khoản GitHub (nếu chưa có)
1. Vào **https://github.com**
2. Đăng ký tài khoản miễn phí

---

## Bước 2: Push code lên GitHub

### 2.1 Cài Git (nếu chưa có)
- **Windows**: Download từ https://git-scm.com/download/win
- **Mac**: `brew install git`

### 2.2 Tạo repository trên GitHub
1. Đăng nhập GitHub
2. Bấm **"+"** → **"New repository"**
3. Repository name: `giong-vn-v6`
4. Chọn **"Public"** hoặc **"Private"**
5. Bấm **"Create repository"**

### 2.3 Push code
Mở Terminal/PowerShell trong thư mục project:

```bash
# Khởi tạo git (nếu chưa có)
git init

# Thêm tất cả files
git add .

# Commit
git commit -m "Initial commit: GIONG VIETNAM app"

# Kết nối với GitHub
git remote add origin https://github.com/YOUR_USERNAME/giong-vn-v6.git

# Push
git branch -M main
git push -u origin main
```

---

## Bước 3: Deploy lên Vercel

### 3.1 Kết nối Vercel với GitHub
1. Đăng nhập **https://vercel.com**
2. Bấm **"Add New..."** → **"Project"**
3. Chọn **"Import Git Repository"**
4. Chọn repository `giong-vn-v6`
5. Bấm **"Import"**

### 3.2 Cấu hình Project
1. **Project Name**: `giong-vn` (hoặc tên tuỳ ý)
2. **Framework Preset**: `Vite` (hoặc auto-detect)
3. **Root Directory**: `./` (để trống)
4. **Build Command**: `npm run build`
5. **Output Directory**: `.vercel/output/static`
6. **Install Command**: `npm install`

### 3.3 Thêm Environment Variables
Bấm vào tab **"Environment Variables"** và thêm:

| Name | Value | Notes |
|------|-------|-------|
| `DATABASE_URL` | `postgresql://...@ep-xxx.neon.tech/giong-vn?sslmode=require` | Connection string từ Neon |

**Lưu ý**: 
- Copy ĐÚNG connection string từ Neon Dashboard
- Bao gồm `?sslmode=require` ở cuối
- Không có khoảng trắng thừa

### 3.4 Deploy
1. Bấm **"Deploy"**
2. Chờ 1-2 phút để build
3. Nhận URL: `https://giong-vn.vercel.app`

---

## Bước 4: Cập nhật Auth Origins

### 4.1 Thêm domain vào Better Auth
Mở file `src/lib/auth/server.ts`, thêm domain Vercel:

```typescript
const TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://giong-vn.vercel.app",  // ← THÊM DÒNG NÀY
];
```

### 4.2 Push lại
```bash
git add .
git commit -m "Add Vercel domain to trusted origins"
git push
```

Vercel sẽ auto-deploy lại trong 1-2 phút.

---

## Bước 5: Tạo Admin User

### 5.1 Tạo user đầu tiên
Truy cập: `https://giong-vn.vercel.app/login`

Đăng ký với email admin:
- Email: `admin@giong.vn`
- Password: `Admin123!`

### 5.2 Set role Admin trong Database
Vào **Neon Dashboard** → SQL Editor → chạy:

```sql
-- Tìm user ID
SELECT id, email FROM "user" WHERE email = 'admin@giong.vn';

-- Cập nhật role (thay 'USER_ID' bằng ID vừa tìm được)
UPDATE "user" 
SET 
  name = 'Admin GIONG',
  role = 'Admin'
WHERE id = 'USER_ID';
```

Hoặc thêm email vào danh sách Admin trong `src/lib/catalog.ts`:

```typescript
export const EMPLOYEES: Employee[] = [
  {
    id: "admin01",
    name: "Admin GIONG",
    email: "admin@giong.vn",
    title: "Quản trị hệ thống",
    role: "Admin",  // ← Đảm bảo role là "Admin"
    department: "Hành chính",
    center: "Tất cả",
  },
  // ... các nhân viên khác
];
```

---

## Bước 6: Cài đặt trên Điện thoại

### 6.1 iOS (iPhone/iPad)
1. Mở **Safari** → vào `https://giong-vn.vercel.app`
2. Đăng nhập
3. Bấm **Share** (□ mũi tên)
4. Chọn **"Add to Home Screen"**
5. Bấm **"Add"**

### 6.2 Android
1. Mở **Chrome** → vào `https://giong-vn.vercel.app`
2. Đăng nhập
3. Bấm **3 chấm** → **"Add to Home screen"**
4. Bấm **"Install"**

### 6.3 Đăng nhập lần đầu
- Email: `admin@giong.vn`
- Password: `Admin123!`

---

## Bước 7: Quản lý Dữ liệu

### 7.1 Xem dữ liệu
Vào **Neon Dashboard** → **Tables** → xem các bảng:
- `user` - Users đã đăng ký
- `session` - Sessions đang hoạt động
- `account` - Tài khoản auth
- `registration_requests` - Yêu cầu đăng ký chờ duyệt

### 7.2 Backup dữ liệu
Neon tự động backup hàng ngày. Manual backup:
1. Neon Dashboard → **Backup**
2. Bấm **"Create Backup"**

### 7.3 Thêm nhân viên mới
Chỉnh file `src/lib/catalog.ts`:

```typescript
export const EMPLOYEES: Employee[] = [
  // ... employees hiện tại
  {
    id: "nv001",
    name: "Nguyễn Văn A",
    email: "nguyenvana@giong.vn",
    title: "Nhân sự",
    role: "Staff",
    department: "Nhân sự",
    center: "Trung tâm 1",
  },
];
```

Push lại để deploy.

---

## Xử lý sự cố

### Lỗi "Invalid Origin"
**Nguyên nhân**: Auth không nhận domain Vercel
**Giải pháp**: Thêm domain vào `TRUSTED_ORIGINS` trong `src/lib/auth/server.ts`

### Lỗi "Invalid Email or Password"
**Nguyên nhân**: Chưa tạo user hoặc sai password
**Giải pháp**: 
1. Đăng ký user mới tại `/login`
2. Hoặc tạo trong Neon SQL Editor

### Lỗi "Cannot connect to Database"
**Nguyên nhân**: `DATABASE_URL` sai hoặc Neon chưa active
**Giải pháp**:
1. Kiểm tra `DATABASE_URL` trong Vercel Environment Variables
2. Vào Neon Dashboard → kiểm tra project status

### Deploy thất bại
**Kiểm tra**:
1. Build logs trên Vercel Dashboard
2. `npm run build` chạy thành công trên local
3. Không có lỗi TypeScript

---

## Chi phí

| Dịch vụ | Free Tier | Đủ dùng? |
|---------|-----------|----------|
| **Vercel** | 100GB bandwidth/tháng | ✅ Đủ |
| **Neon** | 512MB storage, 100 giờ compute/tháng | ✅ Đủ |
| **GitHub** | Unlimited public/private repos | ✅ Đủ |

**Tổng chi phí: $0/tháng** (cho kullanım vừa phải)

---

## Liên kết hữu ích

- **Vercel Docs**: https://vercel.com/docs
- **Neon Docs**: https://neon.tech/docs
- **Better Auth**: https://www.better-auth.com/docs
- **TanStack Start**: https://tanstack.com/start

---

## Cần hỗ trợ?

Nếu gặp lỗi khi deploy, gửi em:
1. Screenshot lỗi trên Vercel Dashboard
2. Build logs (nếu có)
3. Cấu hình Environment Variables

Em sẽ hướng dẫn chi tiết hơn! 🎉
