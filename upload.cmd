@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0upload.ps1"
echo.
echo ============================================
echo  Finished. If you see "Upload OK" above, the
echo  new version is now on GitHub Pages.
echo ============================================
pause
