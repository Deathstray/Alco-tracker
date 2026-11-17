@echo off
title AlcoTracker - server (MySQL mode)

rem -- MySQL mode: uses a full MySQL/MariaDB server (for the diploma defense).
rem -- Start MySQL first (XAMPP Control Panel -> MySQL -> Start) and make sure
rem -- the alkotracker database is imported (see INSTALL.md, Step 1).

cd /d "%~dp0server"
if errorlevel 1 (
    echo Folder "server" not found! Keep start-mysql.bat in the project root.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js not found! Install it from https://nodejs.org and try again.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing server dependencies, please wait...
    call npm install --no-audit --no-fund
)

set ALKOTRACKER_DB=mysql

echo.
echo Starting AlcoTracker server in MySQL mode...
echo (make sure MySQL is running - XAMPP Control Panel, MySQL = green)
echo.

call npm start

echo.
echo Server stopped. If there are errors above, read them.
pause
