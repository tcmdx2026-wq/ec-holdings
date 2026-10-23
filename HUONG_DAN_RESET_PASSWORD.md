# Hướng dẫn Reset Password

## Bước 1: Kiểm tra file code đã cập nhật chưa

Mở file `src/routes/api/auth-reset.ts` và đảm bảo có dòng này:

```typescript
// Check if account exists (Better Auth uses providerId 'email' for email/password)
const accounts = await sql<{ id: string }>`
  SELECT id FROM account WHERE "userId" = ${user.id} AND "providerId" = 'email'
`;
```

Nếu thấy `'credential'` thay vì `'email'` → file chưa được cập nhật.

---

## Bước 2: Kiểm tra DATABASE_URL

Chạy lệnh này trên terminal:

```bash
echo $DATABASE_URL
```

Nếu trả về rỗng → chưa set DATABASE_URL. Cần set trước khi chạy script.

---

## Bước 3: Chạy script reset password

```bash
node scripts/fix-password.mjs
```

Kết quả mong đợi:
```
Connecting to database...
Found user ID: xxx
New hash: xxx:xxx
✅ Password updated successfully!

Login with:
  Email: cuongpk.giong04@gmail.com
  Password: Admin123!
```

Nếu có lỗi → copy toàn bộ lỗi gửi cho em.

---

## Bước 4: Xóa cookie trình duyệt

1. Mở DevTools (F12)
2. Vào tab **Application** → **Cookies**
3. Xóa tất cả cookie của `localhost:3000`
4. Hoặc xóa toàn bộ browsing data

---

## Bước 5: Restart server

```bash
# Dừng server (Ctrl+C)
# Chạy lại
npm run dev
```

---

## Bước 6: Đăng nhập

- Email: `cuongpk.giong04@gmail.com`
- Password: `Admin123!`

---

## Nếu vẫn không được

Chạy lệnh này và gửi kết quả cho em:

```bash
node -e "
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT email FROM \"user\"').then(r => {
  console.log('Users:', r.rows);
  return pool.query('SELECT email, \"providerId\" FROM account');
}).then(r => {
  console.log('Accounts:', r.rows);
  pool.end();
}).catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
"
```
