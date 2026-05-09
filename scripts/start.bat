@echo off
chcp 65001 >nul
title Chimera — MaiBot + Airi + Proxy
echo.
echo   ╔══════════════════════════════╗
echo   ║   Chimera 一键启动          ║
echo   ║   MaiBot 脑 + Airi 身体     ║
echo   ╚══════════════════════════════╝
echo.

REM ==================== 1. MaiBot ====================
echo [1/3] 启动 MaiBot...
set ELECTRON_RUN_AS_NODE=
start "MaiBot" cmd /c "cd /d %~dp0..\MaiBot && uv run python bot.py"

echo   等待 MaiBot WebSocket 就绪...
:wait_maibot
timeout /t 2 /nobreak >nul
curl -s http://127.0.0.1:8523/ws >nul 2>&1
if errorlevel 1 goto wait_maibot
echo   MaiBot 已就绪。

REM ==================== 2. Chimera Proxy ====================
echo [2/3] 启动 Chimera 代理...
set MAIBOT_WS_URL=ws://127.0.0.1:8523/ws
start "Chimera Proxy" cmd /c "cd /d %~dp0..\packages\airsaka-proxy && pnpm dev"

echo   等待代理就绪...
:wait_proxy
timeout /t 1 /nobreak >nul
curl -s http://127.0.0.1:8524/health >nul 2>&1
if errorlevel 1 goto wait_proxy
echo   代理已就绪。

REM ==================== 3. Airi ====================
echo [3/3] 启动 Airi...
start "" "D:\Airi\airi.exe"

echo.
echo   ==============================
echo   全部启动完成！
echo   MaiBot  : ws://127.0.0.1:8523/ws
echo   代理    : http://localhost:8524
echo   Airi    : 桌面窗口已打开
echo   ==============================
echo.
echo   关闭此窗口不会停止服务。在 Airi 设置中确认 Provider Base URL:
echo   http://localhost:8524
echo.
pause
