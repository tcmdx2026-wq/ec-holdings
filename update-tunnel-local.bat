@echo off
chcp 65001 >nul
title GIONG VN - Cap nhat tunnel URL

:: =====================================================
:: GIONG VN - CAP NHAT TUNNEL URL CHO LOCAL
:: Bam dup khi app bao loi du lieu / "Sai mat khau" o local.
:: Lay URL tunnel MOI NHAT tu GitHub Gist ghi vao .env.local
:: cua ca 2 app. Xong thi DONG 2 cua so app va chay lai
:: start-local.bat (dev server doc env luc khoi dong).
:: =====================================================

echo.
echo Dang lay URL tunnel moi nhat tu GitHub Gist...
cd /d D:\DuLieuChung\CUONG_2026\giong-vn-v6

python -X utf8 scripts\update-tunnel-env.py
if errorlevel 1 (
  echo.
  echo [LOI] Khong cap nhat duoc - kiem tra internet hoac bao tro ly biet.
  echo.
  pause
  exit /b 1
)

echo.
echo Xong! Bay gio DONG 2 cua so app (neu dang mo) va chay lai start-local.bat
echo.
pause
