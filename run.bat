@echo off
cd /d "%~dp0backend"
echo Starting Budget Manager...
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
