@echo off
echo Deploying Firestore security rules...
echo.

firebase deploy --only firestore:rules

if %ERRORLEVEL% EQU 0 (
  echo.
  echo Rules deployed successfully!
) else (
  echo.
  echo Deploy failed. Make sure you are logged in: firebase login
)
pause
