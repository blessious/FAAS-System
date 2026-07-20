@echo off
setlocal
set "ROOT=%~dp0"
set "LARAGON_ROOT=C:\laragon\www\faas-system"

cd /d "%ROOT%" || exit /b 1

echo Building frontend...
npm run build
if errorlevel 1 exit /b 1

if not exist "%LARAGON_ROOT%" (
  mkdir "%LARAGON_ROOT%"
)

echo Copying frontend build to Laragon...
xcopy /E /I /Y "%ROOT%dist\*" "%LARAGON_ROOT%\" >nul

if errorlevel 1 (
  echo Copy failed.
  exit /b 1
)

echo Done. Frontend deployed to %LARAGON_ROOT%.
endlocal
