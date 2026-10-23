# 🚀 HƯỚNG DẪN DEPLOY TỪNG BƯỚC
## GIONG VIỆT NAM - Quản lý chuỗi trung tâm tiêm chủng

---

## 📋 TỔNG QUAN CÁC BƯỚC

```
Bước 1: Tạo tài khoản Neon (Database)     ⏱️ 5 phút
Bước 2: Tạo tài khoản Vercel (Hosting)    ⏱️ 5 phút
Bước 3: Tạo tài khoản GitHub (Code)       ⏱️ 5 phút
Bước 4: Push code lên GitHub              ⏱️ 10 phút
Bước 5: Deploy trên Vercel                ⏱️ 15 phút
Bước 6: Cài đặt trên điện thoại           ⏱️ 5 phút

TỔNG THỜI GIAN: ~45 phút
```

---

## BƯỚC 1: TẠO TÀI KHOẢN NEON (Database miễn phí)

### 1.1 Truy cập Neon
1. Mở trình duyệt → vào: **https://neon.tech**
2. Bấm nút **"Sign Up"** (góc trên bên phải)

### 1.2 Đăng ký
1. Chọn **"Continue with GitHub"** (để dùng tài khoản GitHub)
   - Hoặc chọn **"Continue with Google"** nếu có Gmail
2. Đăng nhập GitHub/Google của anh
3. Bấm **"Authorize"** cho phép Neon truy cập

### 1.3 Tạo Database Project
1. Sau khi đăng nhập, bấm **"Create Project"**
2. Điền thông tin:
   - **Project name**: `giong-vn`
   - **Database name**: `giongvn` (tự động điền)
   - **Region**: Chọn **"Southeast Asia (Singapore)"** (gần Việt Nam nhất)
3. Bấm **"Create Project"**

### 1.4 Copy Connection String
1. Neon sẽ hiển thị **Connection Details**
2. Copy **Connection string** (kiểu như sau):

```
postgresql://neondb_owner:xxxxxxxxxxxx@ep-xxx-xxx.us-east-2.aws.neon.tech/giongvn?sslmode=require
```

3. **LƯU LẠI** somewhere an toàn (Notepad, Word...) - sẽ dùng ở Bước 5

### ✅ Kiểm tra đã xong chưa?
- [ ] Có tài khoản Neon
- [ ] Có Project `giong-vn`
- [ ] Đã copy Connection string

---

## BƯỚC 2: TẠO TÀI KHOẢN VERCEL (Hosting miễn phí)

### 2.1 Truy cập Vercel
1. Mở trình duyệt → vào: **https://vercel.com**
2. Bấm nút **"Sign Up"** (góc trên bên phải)

### 2.2 Đăng ký
1. Chọn **"Continue with GitHub"**
2. Đăng nhập GitHub của anh (vừa tạo ở Bước 1)
3. Bấm **"Authorize"** cho phép Vercel truy cập

### 2.3 Hoàn tất Profile
1. Điền **Name**: Anh có thể điền tên tiếng Việt hoặc tiếng Anh
2. Bấm **"Continue"**
3. Chọn **"Hobby"** (dùng miễn phí)
4. Bấm **"Continue"** → **"Done"**

### ✅ Kiểm tra đã xong chưa?
- [ ] Có tài khoản Vercel
- [ ] Đăng nhập thành công

---

## BƯỚC 3: TẠO TÀI KHOẢN GITHUB (Nếu chưa có)

> **Bỏ qua bước này nếu anh đã có tài khoản GitHub**

### 3.1 Truy cập GitHub
1. Mở trình duyệt → vào: **https://github.com**
2. Bấm nút **"Sign up"** (góc trên bên phải)

### 3.2 Đăng ký
1. Nhập **Email** của anh
2. Tạo **Password** (ít nhất 8 ký tự)
3. Chọn **Username** (tên hiển thị, ví dụ: `cuongpk-giong`)
4. Xác nhận không phải robot
5. Bấm **"Create account"**

### 3.3 Xác nhận Email
1. Vào email → tìm email từ GitHub
2. Bấm **"Verify email address"**

### ✅ Kiểm tra đã xong chưa?
- [ ] Có tài khoản GitHub
- [ ] Đã xác nhận email

---

## BƯỚC 4: PUSH CODE LÊN GITHUB

### 4.1 Tạo Repository trên GitHub
1. Đăng nhập **https://github.com**
2. Bấm nút **"+"** (góc trên bên phải) → **"New repository"**
3. Điền thông tin:
   - **Repository name**: `giong-vn-v6`
   - **Description**: `GIONG VIETNAM - Quan ly chuoi trung tam tiem chung`
   - Chọn **"Public"** hoặc **"Private"** (tùy anh)
4. **KHÔNG tick** bất kỳ checkbox nào (no README, no .gitignore)
5. Bấm **"Create repository"**

### 4.2 Cài Git trên máy tính
1. Download Git: **https://git-scm.com/download/win**
2. Cài đặt (Next → Next → Finish)
3. Mở **PowerShell** hoặc **Command Prompt**

### 4.3 Push code
Mở Terminal trong thư mục project:

```powershell
# Bước 1: Vào thư mục project
cd D:\DuLieuChung\CUONG_2026\giong-vn-v6

# Bước 2: Khởi tạo Git
git init

# Bước 3: Thêm tất cả files
git add .

# Bước 4: Commit
git commit -m "First commit: GIONG VIETNAM app"

# Bước 5: Kết nối với GitHub (thay YOUR_USERNAME bằng username của anh)
git remote add origin https://github.com/YOUR_USERNAME/giong-vn-v6.git

# Bước 6: Push
git branch -M main
git push -u origin main
```

### ✅ Kiểm tra đã xong chưa?
- [ ] Có repository `giong-vn-vn-v6` trên GitHub
- [ ] Code đã push thành công

---

## BƯỚC 5: DEPLOY TRÊN VERCEL

### 5.1 Kết nối Vercel với GitHub
1. Đăng nhập **https://vercel.com**
2. Bấm **"Add New..."** → **"Project"**
3. Tab **"Import Git Repository"**
4. Tìm repository `giong-vn-v6`
5. Bấm **"Import"**

### 5.2 Cấu hình Project
1. **Project Name**: `giong-vn`
2. **Framework Preset**: `Vite` (hoặc để auto-detect)
3. **Root Directory**: `./` (để trống)
4. **Build Command**: `npm run build` (đúng rồi)
5. **Output Directory**: `.vercel/output/static`
6. **Install Command**: `npm install`

### 5.3 Thêm Environment Variables ⚠️ QUAN TRỌNG

Bấm vào tab **"Environment Variables"** và thêm lần lượt:

#### Variable 1: DATABASE_URL
```
Name:     DATABASE_URL
Value:    postgresql://neondb_owner:xxxxxxxxxxxx@ep-xxx-xxx.us-east-2.aws.neon.tech/giongvn?sslmode=require
```
> Copy từ Bước 1.4

#### Variable 2: BETTER_AUTH_URL
```
Name:     BETTER_AUTH_URL
Value:    https://giong-vn.vercel.app
```
> Thay `giong-vn` bằng tên project Vercel của anh

#### Variable 3: BETTER_AUTH_SECRET
Để tạo secret key, mở Terminal chạy:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Kết quả sẽ là chuỗi random, ví dụ: `a1b2c3d4e5f6...`

Rồi thêm vào Vercel:
```
Name:     BETTER_AUTH_SECRET
Value:    (chuỗi vừa tạo)
```

#### Variable 4: VITE_AUTH_ENABLED
```
Name:     VITE_AUTH_ENABLED
Value:    true
```

### 5.4 Deploy
1. Kiểm tra lại tất cả Environment Variables
2. Bấm nút **"Deploy"**
3. Chờ **1-2 phút** để build và deploy
4. Thành công sẽ hiện **"Congratulations!"**

### 5.5 Lấy URL
1. Vào **Project** → **Domains**
2. Copy URL, ví dụ: `https://giong-vn.vercel.app`

### ✅ Kiểm tra đã xong chưa?
- [ ] Deploy thành công (xanh ✓)
- [ ] Có URL: `https://giong-vn.vercel.app`
- [ ] Mở URL thấy trang login

---

## BƯỚC 6: CÀI ĐẶT TRÊN ĐIỆN THOẠI

### 6.1 iOS (iPhone/iPad)
1. Mở **Safari** trên iPhone
2. Vào URL: `https://giong-vn.vercel.app`
3. Đăng nhập với tài khoản vừa tạo
4. Bấm nút **Share** (□ có mũi tên lên)
5. Cuộn xuống → chọn **"Add to Home Screen"**
6. Đổi tên thành `GIONG VN` (tùy ý)
7. Bấm **"Add"**

### 6.2 Android
1. Mở **Chrome** trên Android
2. Vào URL: `https://giong-vn.vercel.app`
3. Đăng nhập
4. Bấm **3 chấm** (góc trên bên phải)
5. Chọn **"Add to Home screen"** hoặc **"Install app"**
6. Bấm **"Install"**

### 6.3 Đăng nhập lần đầu
- Email: `admin@giong.vn` (hoặc email anh đăng ký)
- Password: Mật khẩu anh tạo khi đăng ký

### ✅ Kiểm tra đã xong chưa?
- [ ] Có icon GIONG VN trên màn hình điện thoại
- [ ] Mở app thấy trang chủ
- [ ] Đăng nhập thành công

---

## 🎉 HOÀN TÀNH!

### Tổng kết

| Bước | Trạng thái | Ghi chú |
|------|-----------|---------|
| 1. Neon Database | ✅ | Free 512MB |
| 2. Vercel Hosting | ✅ | Free 100GB/tháng |
| 3. GitHub | ✅ | Free unlimited |
| 4. Push code | ✅ | Code đã up |
| 5. Deploy | ✅ | App đang chạy |
| 6. Cài điện thoại | ✅ | Dùng như app gốc |

### Chi phí

| Dịch vụ | Free Tier | Đủ dùng? |
|---------|-----------|----------|
| Vercel | 100GB bandwidth | ✅ |
| Neon | 512MB storage | ✅ |
| GitHub | Unlimited repos | ✅ |
| **TỔNG** | **$0/tháng** | ✅ |

### Liên kết

- **App**: `https://giong-vn.vercel.app`
- **Vercel Dashboard**: `https://vercel.com/dashboard`
- **Neon Dashboard**: `https://console.neon.tech`

---

## ❓ XỬ LÝ SỰ CỐ

### Lỗi "Invalid Origin"
**Giải pháp**: Thêm domain Vercel vào `src/lib/auth/server.ts`

### Lỗi "Cannot connect to Database"
**Giải pháp**: Kiểm tra `DATABASE_URL` trong Vercel

### Lỗi Deploy thất bại
**Giải pháp**: Xem build logs trên Vercel Dashboard

### Cần hỗ trợ?
Gửi em:
1. Screenshot lỗi
2. Build logs (nếu có)
3. Mô tả bước đang làm

---

## 📞 HỖ TRỢ

Nếu gặp khó khăn ở bất kỳ bước nào, hãy:
1. Đọc lại hướng dẫn ở bước đó
2. Xem video hướng dẫn trên YouTube (tìm "deploy Vercel")
3. Hỏi em - em sẽ hướng dẫn chi tiết hơn!

**Chúc anh deploy thành công! 🎉**
