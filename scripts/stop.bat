@echo off
echo 停止 Chimera 全部服务...
taskkill /f /im airi.exe 2>nul
taskkill /f /im python.exe 2>nul
taskkill /f /im node.exe /fi "WINDOWTITLE eq Chimera*" 2>nul
echo 已停止。
pause
