@echo off
echo Stopping all AAR processes...
taskkill /f /fi "WINDOWTITLE eq AAR*" >nul 2>&1
echo Done.
pause
