@echo off
echo Starting LGU Real Property Approval System...
echo.

echo Step 1: Starting Backend Server...
cd backend
start cmd /k "npm run dev"
cd ..

echo Step 2: Starting Frontend React App...
start cmd /k "npm run dev"
