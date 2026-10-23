@echo off
rem =====================================================================
rem GIONG VN — MO WINDOWS FIREWALL CHO LOCAL (GĐ 312)
rem
rem Chay 1 LAN DUY NHAT: chuot phai file nay -> "Run as Administrator".
rem Mo port 3000 (app tong) + 3100 (app con) cho may khac trong LAN.
rem =====================================================================
chcp 65001 >nul
title GIONG VN - Mo firewall local

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo [LOI] Can quyen Administrator!
  echo   Chuot phai file nay -^> "Run as Administrator" roi chay lai.
  echo.
  pause
  exit /b 1
)

echo Dang mo port 3000 + 3100 cho may khac trong mang LAN...

netsh advfirewall firewall delete rule name="GIONG VN local dev 3000" >nul 2>&1
netsh advfirewall firewall delete rule name="GIONG VN local dev 3100" >nul 2>&1
netsh advfirewall firewall add rule name="GIONG VN local dev 3000" dir=in action=allow protocol=TCP localport=3000 profile=any
netsh advfirewall firewall add rule name="GIONG VN local dev 3100" dir=in action=allow protocol=TCP localport=3100 profile=any

if errorlevel 1 (
  echo.
  echo [LOI] netsh that bai — kiem tra antivirus/phan mem bao mat.
) else (
  echo.
  echo [OK] Da mo port 3000 + 3100 — may khac trong LAN vao duoc:
  echo      App tong : http://192.168.1.250:3000
  echo      App con  : http://192.168.1.250:3100
  echo      (Chay "start-local.bat lan" truoc khi may khac mo URL nay.)
)
echo.
pause
