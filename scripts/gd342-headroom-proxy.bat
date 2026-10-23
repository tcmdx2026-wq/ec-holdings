@echo off
rem ============================================================
rem GD 342 (2026-10-07) - Headroom nen context cho Claude Code
rem Chuoi 3 lop: Claude Code (8787) -> Headroom proxy (nen 60-95%)
rem              -> 9router (20128) -> model (GPT-5.x / Claude)
rem
rem Cach dung: bam doi startup-headroom-proxy.bat truoc khi mo Claude Code.
rem Tat cua so nay = tat nen (Claude Code se mat ket noi -> mo lai script).
rem Khoi phuc nhu cu: copy settings.json.gd342-bak thay settings.json
rem   (trong C:\Users\Administrator\.claude\)
rem ============================================================

set "ANTHROPIC_TARGET_API_URL=http://127.0.0.1:20128/v1"
set "HEADROOM_PORT=8787"

echo [GD342] Khoi dong Headroom proxy - nen context cho Claude Code...
echo [GD342] Upstream: 9router (port 20128). Lang nghe: 127.0.0.1:8787
echo [GD342] Mo Claude Code trong cua so khac. Bam Ctrl+C de tat.
echo.

"C:\Users\Administrator\.local\bin\headroom.exe" proxy --port 8787
