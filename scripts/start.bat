@echo off
title Chimera Launcher
echo.
echo ========================================
echo   Chimera - MaiBot + Airi + Proxy
echo ========================================
echo.

cd /d "%~dp0.."

REM ---- 1. MaiBot ----
echo [1/3] Starting MaiBot...
start "MaiBot" cmd /c "cd /d %CD%\MaiBot && uv run python bot.py"
echo   Waiting for MaiBot WebSocket...
:wait_mai
ping -n 3 127.0.0.1 >nul
curl -s -o nul http://127.0.0.1:8523/ws 2>nul
if errorlevel 1 goto wait_mai
echo   MaiBot ready.

REM ---- 2. Proxy ----
echo [2/3] Starting Chimera proxy...
start "ChimeraProxy" cmd /c "cd /d %CD%\packages\airsaka-proxy && pnpm dev"
echo   Waiting for proxy...
:wait_proxy
ping -n 2 127.0.0.1 >nul
curl -s -o nul http://127.0.0.1:8524/health 2>nul
if errorlevel 1 goto wait_proxy
echo   Proxy ready.

REM ---- 3. Airi ----
echo [3/3] Starting Airi...
start "" "D:\Airi\airi.exe"

echo.
echo ========================================
echo   All services started.
echo   MaiBot : ws://127.0.0.1:8523/ws
echo   Proxy  : http://localhost:8524
echo   Airi   : running
echo.
echo   Set Airi provider baseURL to:
echo   http://localhost:8524
echo ========================================
pause
