# ✅ Checklist Deploy nhanh

## 📋 Trước khi deploy

- [ ] Tạo tài khoản **Vercel** (https://vercel.com)
- [ ] Tạo tài khoản **Neon** (https://neon.tech)
- [ ] Tạo repository **GitHub** (https://github.com)

## 🔧 Steps deploy

### 1. Tạo Database trên Neon
```bash
1. Đăng nhập neon.tech
2. Bấm "Create Project"
3. Tên: giong-vn
4. Region: Southeast Asia (Singapore)
5. Copy Connection string (postgresql://...)
```

### 2. Push code lên GitHub
```bash
cd D:\DuLieuChung\CUONG_2026\giong-vn-v6

git init
git add .
git commit -m "Deploy to Vercel"
git remote add origin https://github.com/YOUR_USERNAME/giong-vn-v6.git
git branch -M main
git push -u origin main
```

### 3. Deploy trên Vercel
```bash
1. Đăng nhập vercel.com
2. Bấm "Add New..." → "Project"
3. Import repository: giong-vn-v6
4. Framework: Vite (auto-detect)
5. Root Directory: ./
6. Build Command: npm run build
7. Output Directory: .vercel/output/static
```

### 4. Thêm Environment Variables
```
DATABASE_URL = postgresql://user:pass@ep-xxx.neon.tech/giong-vn?sslmode=require
BETTER_AUTH_URL = https://giong-vn.vercel.app
BETTER_AUTH_SECRET = (tự tạo secret key ngẫu nhiên)
```

**Cách tạo BETTER_AUTH_SECRET:**
```bash
# Chạy lệnh này trên terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Deploy
```bash
Bấm "Deploy" → chờ 1-2 phút
```

### 6. Cài đặt trên điện thoại
```bash
iOS: Safari → Share → Add to Home Screen
Android: Chrome → 3 chấm → Add to Home screen
```

## 🎯 Kết quả

Sau khi deploy xong:
- **URL**: `https://giong-vn.vercel.app`
- **Login**: Đăng ký email mới tại `/login`
- **Admin**: Set role trong Neon SQL Editor
- **Data**: Lưu trên Neon PostgreSQL (miễn phí 512MB)

## ⚠️ Lưu ý quan trọng

1. **DATABASE_URL**: Phải copy ĐÚNG từ Neon, includes `?sslmode=require`
2. **BETTER_AUTH_URL**: Phau với domain Vercel (https://giong-vn.vercel.app)
3. **BETTER_AUTH_SECRET**: Phải là string ngẫu nhiên, KHÔNG share
4. **第一次 login**: Đăng ký email mới, sau đó set role Admin trong database

## 🆘 Nếu gặp lỗi

| Lỗi | Giải pháp |
|------|-----------|
| Invalid Origin | Thêm domain vào `TRUSTED_ORIGINS` |
| Invalid Password | Set lại password trong Neon SQL Editor |
| Cannot connect DB | Kiểm tra `DATABASE_URL` |
| Deploy fail | Check build logs trên Vercel |

---

**Chi phí: $0/tháng** (Vercel free tier + Neon free tier)
