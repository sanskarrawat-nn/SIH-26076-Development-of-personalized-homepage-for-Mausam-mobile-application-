@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ============================================
echo Building Mausam Setu Clean Submission Zip
echo ============================================

REM Check if python is available in PATH or backend venv
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python scripts\make_submission_zip.py
    exit /b !ERRORLEVEL!
)

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py scripts\make_submission_zip.py
    exit /b !ERRORLEVEL!
)

if exist backend\.venv\Scripts\python.exe (
    backend\.venv\Scripts\python.exe scripts\make_submission_zip.py
    exit /b !ERRORLEVEL!
)

echo ERROR: Python executable not found. Please install Python 3.12+ or configure PATH.
exit /b 1
