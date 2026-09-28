@echo off
setlocal enabledelayedexpansion

echo ========================================
echo LGU Real Property Approval System
echo ========================================
echo.

echo.
echo Step 1: Starting Backend Server (Port 3002)...
start "FAAS Backend" /D "%~dp0backend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

echo Step 2: Starting Frontend App (Port 8082)...
start "FAAS Frontend" /D "%~dp0" cmd /k "npm run dev"

echo.
echo ========================================
echo Services are starting...
echo Frontend: http://localhost:8082
echo Backend:  http://localhost:3002/api/
echo ========================================
echo.
echo Keep this window open to run services.
