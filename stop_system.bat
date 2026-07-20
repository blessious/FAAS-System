@echo off
setlocal enabledelayedexpansion
set "LOG_FILE=%~dp0stop_system.log"
set "FAAS_PATH=%~dp0"
echo Stopping FAAS System... > "%LOG_FILE%"
echo. >> "%LOG_FILE%"
echo Stopping FAAS System...
echo.

REM Use PowerShell to find and kill only FAAS-System processes
powershell -NoProfile -Command "$faasPath = '%FAAS_PATH%'; $matches = Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like ('*' + $faasPath + '*') }; if ($matches) { $matches | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host 'FAAS System stopped.'; } else { Write-Host 'No FAAS node processes found.'; }" >> "%LOG_FILE%" 2>&1

echo.
echo Output saved to %LOG_FILE%
pause
