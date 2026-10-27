@echo off
chcp 65001 >nul
cd /d "%~dp0"
python align_right.py
pause
