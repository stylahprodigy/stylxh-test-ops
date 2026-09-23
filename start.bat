@echo off
title IT HERO Field App - Local Dev & Preview
echo ========================================================
echo             IT HERO FIELD COMPANION APP
echo                 Local Dev Server
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
)

call npx expo start -c
pause
