@echo off
rem =====================================================================
rem GIONG VN — BẤM ĐÚP: chạy LOCAL chế độ LAN (GĐ 312)
rem   = gọi start-local.bat lan
rem Máy trạm trong LAN mở: http://192.168.1.250:3000
rem LẦN ĐẦU TIÊN: chạy 1 LẦN start-firewall-local.bat (Run as Administrator)
rem XONG: đóng 2 cửa sổ app cũ trước khi chạy lại file này.
rem =====================================================================
call "%~dp0start-local.bat" lan
