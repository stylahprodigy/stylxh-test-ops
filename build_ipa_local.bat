@echo off
title IT HERO Field App - Local IPA Builder (No Expo)
echo ========================================================
echo             IT HERO FIELD COMPANION APP
echo          Local Standalone IPA Builder (No Expo)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Bundling app files for offline execution...
call npx expo export -p web

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Export failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Building iOS Payload and packaging IPA...
py package_ipa.py

echo.
echo [3/3] Done!
pause
