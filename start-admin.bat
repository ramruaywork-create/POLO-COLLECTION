@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" http://localhost:8800/admin.html
python admin_server.py
pause
