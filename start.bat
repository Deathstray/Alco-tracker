@echo off
title AlcoTracker - server

rem -- go to the server folder (start.bat must stay in the project root)
cd /d "%~dp0server"
if errorlevel 1 (
    echo Folder "server" not found! Keep start.bat in the project root.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js not found! Install it from https://nodejs.org and run start.bat again.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing server dependencies, please wait...
    call npm install --no-audit --no-fund
)

echo.
echo Starting AlcoTracker server...
echo.
echo Uses the built-in SQLite database - no MySQL or XAMPP needed.
echo The database file (server\alkotracker.db) is created automatically
echo on first start with demo data (login: demo / password: demo123).
echo.
echo After the server starts, open in your browser:
echo.
echo     http://localhost:3000
echo.
echo Keep this window open while the app is running.
echo.

call npm start

echo.
echo Server stopped. If there are errors above, read them.
pause
