@echo off
title JanVyapar - Sovereign Offline Order Management System
echo ======================================================
echo    Starting JanVyapar Sovereign Offline System...
echo ======================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Node.js detected. Launching zero-dependency web server...
    node scripts/serve.mjs
    goto end
)

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Python detected. Launching static web server...
    start http://localhost:5173
    python -m http.server 5173 --directory artifacts/orders-app/dist/public
    goto end
)

echo [ERROR] Neither Node.js nor Python was found on your PATH.
echo Please install Node.js (https://nodejs.org) to run this application.
pause

:end
