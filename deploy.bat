@echo off
echo ================================
echo   Findzzer Fit - Deploy Script
echo ================================
echo.

:: Check if Firebase CLI is installed
firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Firebase CLI not found. Installing...
    npm install -g firebase-tools
    echo.
)

:: Build the app
echo [1/3] Building app...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Fix errors and try again.
    pause
    exit /b 1
)
echo [OK] Build successful.
echo.

:: Login check
echo [2/3] Checking Firebase login...
firebase login --no-localhost
echo.

:: Deploy
echo [3/3] Deploying to Firebase Hosting...
firebase deploy --only hosting
if %errorlevel% neq 0 (
    echo [ERROR] Deploy failed.
    pause
    exit /b 1
)

echo.
echo ================================
echo   Deploy complete!
echo   https://gymplaner-55c9d.web.app
echo ================================
pause
