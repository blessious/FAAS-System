@echo off
setlocal enabledelayedexpansion

echo ========================================
echo LGU Real Property Approval System
echo ========================================
echo.

echo Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo Step 1: Starting Backend Server (Port 3000)...
start "FAAS Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul

echo Step 2: Starting Frontend App (Port 8081)...
start "FAAS Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Services are starting...
echo Frontend: http://faas.icts.net
echo Backend:  http://faas.icts.net/api/
echo ========================================
echo.
echo Keep this window open to run services.
