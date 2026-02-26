@echo off
chcp 65001 >nul
echo ============================================
echo   정량제안서 작성 시스템 종료
echo ============================================
echo.

:: uvicorn (백엔드) 종료
echo 백엔드 서버 종료 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: vite (프론트엔드) 종료
echo 프론트엔드 서버 종료 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo 모든 서버가 종료되었습니다.
timeout /t 2 /nobreak >nul
