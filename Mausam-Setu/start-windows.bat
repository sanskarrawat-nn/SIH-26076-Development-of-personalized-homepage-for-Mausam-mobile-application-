@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1 || (echo Install Python 3.12 first. & pause & exit /b 1)
where npm >nul 2>&1 || (echo Install Node.js 22 first. & pause & exit /b 1)
if not exist backend\.venv\Scripts\python.exe python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (pause & exit /b 1)
cd frontend
call npm ci
if errorlevel 1 (pause & exit /b 1)
cd ..
start "Mausam API" cmd /k call "%~dp0backend\run-windows.bat"
start "Mausam Frontend" cmd /k call "%~dp0frontend\run-windows.bat"
echo Open http://localhost:5173 when the frontend is ready.
echo Keep both new terminal windows open.
pause
