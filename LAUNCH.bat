@echo off
title AAR - Full System Launcher
color 0B
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║       عينك عالرجعة - Aaynak Aal Raj3a               ║
echo  ║       AI Airport Security Platform                   ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ─── Check Python ────────────────────────────────────────
echo  [1/5] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [FAIL] Python not found!
    pause
    exit /b 1
)
echo  [OK] Python found
echo.

:: ─── Install Python deps ─────────────────────────────────
echo  [2/5] Installing Python dependencies...
pip install -r requirements.txt -q 2>nul
echo  [OK] Python dependencies ready
echo.

:: ─── Install Frontend deps ───────────────────────────────
echo  [3/5] Installing frontend dependencies...
cd frontend
if not exist node_modules (
    call npm install --silent 2>nul
) else (
    echo         node_modules exists, skipping...
)
cd ..
echo  [OK] Frontend dependencies ready
echo.

:: ─── Start Backend ───────────────────────────────────────
echo  [4/5] Starting Backend API...
start "AAR Backend - Port 8000" cmd /k "title AAR Backend && color 0A && python server.py"
echo  [OK] Backend starting on http://localhost:8000
timeout /t 5 /nobreak >nul

:: ─── Start Frontend ──────────────────────────────────────
echo  [5/5] Starting Frontend Dashboard...
start "AAR Frontend - Port 3000" cmd /k "title AAR Frontend && color 0D && cd frontend && npx vite --port 3000"
echo  [OK] Frontend starting on http://localhost:3000
timeout /t 5 /nobreak >nul

:: ─── Open browser ────────────────────────────────────────
start http://localhost:3000

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   ALL SYSTEMS RUNNING!                              ║
echo  ║                                                     ║
echo  ║   Backend:    http://localhost:8000                  ║
echo  ║   Swagger:    http://localhost:8000/docs             ║
echo  ║   Dashboard:  http://localhost:3000                  ║
echo  ║                                                     ║
echo  ║   Login:  admin / admin123                           ║
echo  ║                                                     ║
echo  ║   To start AI webcam detection:                     ║
echo  ║   python run_ai.py --mode queue                     ║
echo  ║   python run_ai.py --mode tracking                  ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Press any key to exit this launcher (services keep running)...
pause >nul
