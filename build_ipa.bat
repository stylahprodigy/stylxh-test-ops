@echo off
title IT HERO Field App - Standalone iOS IPA Builder
echo ========================================================
echo             IT HERO FIELD COMPANION APP
echo           Standalone iOS IPA Build (For KSign)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node dependencies...
if not exist "node_modules" (
    echo [INFO] Installing npm dependencies...
    call npm install
) else (
    echo [OK] Dependencies are present.
)

echo.
echo [2/3] Checking EAS CLI login status...
echo (If you do not have an Expo account, create a free one at https://expo.dev/signup)
echo.
call npx -y eas-cli whoami 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ACTION REQUIRED] Please log in with your free Expo account:
    call npx -y eas-cli login
)

echo.
echo [3/3] Starting Standalone iOS IPA Build...
echo Profile: preview (Device IPA distribution)
echo.
call npx -y eas-cli build --platform ios --profile preview

echo.
echo ========================================================
echo When the build finishes:
echo 1. Download the generated .ipa file from the link above.
echo 2. Transfer/Airdrop the .ipa to your iPhone.
echo 3. Open KSign, import the .ipa, sign and tap Install!
echo ========================================================
pause
