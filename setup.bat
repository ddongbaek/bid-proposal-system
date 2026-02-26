@echo off
chcp 65001 >nul
title 정량제안서 시스템 - 최초 설치

echo ============================================
echo   정량제안서 작성 시스템 - 최초 설치
echo ============================================
echo.
echo   이 스크립트는 최초 1회만 실행하면 됩니다.
echo   이후에는 start.bat 으로 시작하세요.
echo.
pause

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

:: ===== 1. Python 확인 =====
echo.
echo [1/6] Python 확인...
python --version
if %ERRORLEVEL% neq 0 (
    echo [오류] Python이 설치되지 않았습니다.
    echo        https://www.python.org/downloads/ 에서 3.11 이상 설치하세요.
    pause
    exit /b 1
)

:: ===== 2. Node.js 확인 =====
echo [2/6] Node.js 확인...
node --version
if %ERRORLEVEL% neq 0 (
    echo [오류] Node.js가 설치되지 않았습니다.
    echo        https://nodejs.org/ 에서 LTS 버전을 설치하세요.
    pause
    exit /b 1
)

:: ===== 3. 데이터 디렉토리 생성 =====
echo [3/6] 데이터 디렉토리 생성...
if not exist "data\db" mkdir "data\db"
if not exist "data\uploads" mkdir "data\uploads"
if not exist "data\thumbnails" mkdir "data\thumbnails"
if not exist "data\generated" mkdir "data\generated"
echo        OK

:: ===== 4. 백엔드 패키지 설치 =====
echo [4/6] 백엔드 Python 패키지 설치...
cd /d "%PROJECT_ROOT%backend"
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [오류] pip install 실패
    pause
    exit /b 1
)

:: ===== 5. Playwright Chromium 설치 =====
echo [5/6] Playwright Chromium 설치 (PDF 생성용, ~100MB)...
python -m playwright install chromium
if %ERRORLEVEL% neq 0 (
    echo [경고] Playwright 설치 실패. PDF 생성이 작동하지 않을 수 있습니다.
)

:: ===== 6. 프론트엔드 패키지 설치 =====
echo [6/6] 프론트엔드 npm 패키지 설치...
cd /d "%PROJECT_ROOT%frontend"
npm install
if %ERRORLEVEL% neq 0 (
    echo [오류] npm install 실패
    pause
    exit /b 1
)

:: ===== .env 확인 =====
cd /d "%PROJECT_ROOT%"
if not exist ".env" (
    echo.
    echo [알림] .env 파일이 없습니다. .env.example을 복사합니다.
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo        .env 파일이 생성되었습니다.
        echo        필요 시 GEMINI_API_KEY를 설정하세요.
    ) else (
        echo        .env.example도 없습니다. 수동으로 .env를 생성하세요.
    )
)

echo.
echo ============================================
echo   설치 완료!
echo.
echo   시작: start.bat 더블클릭
echo   종료: stop.bat 더블클릭
echo   주소: http://localhost:5173
echo ============================================
echo.
pause
