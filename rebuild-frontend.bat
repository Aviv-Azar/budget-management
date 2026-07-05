@echo off
cd /d "%~dp0frontend"
echo Rebuilding frontend...
call npm run build
echo Done. Restart run.bat to see the changes.
