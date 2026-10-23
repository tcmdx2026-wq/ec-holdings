@echo off
rem =====================================================================
rem GIONG VN — BẤM ĐÚP: chạy LOCAL chế độ PUBLIC (GĐ 312)
rem   = gọi start-local.bat public
rem Tự mở Quick Tunnel + in 2 URL https://...trycloudflare.com trên màn hình
rem → gửi URL App tong cho người dùng ngoài LAN. URL ĐỔI MỖI LẦN chạy lại.
rem XONG: đóng 2 cửa sổ app cũ trước khi chạy lại file này.
rem =====================================================================
call "%~dp0start-local.bat" public
