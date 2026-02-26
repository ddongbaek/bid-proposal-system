@echo off
chcp 65001 >nul
title 정량제안서 작성 시스템

echo ============================================
echo   정량제안서 작성 시스템 시작
echo ============================================
echo.

:: 프로젝트 루트 경로
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

:: ===== 1. 사전 체크 =====
echo [1/5] 환경 확인 중...

:: Python 확인
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [오류] Python이 설치되지 않았습니다.
    echo        https://www.python.org/downloads/ 에서 설치하세요.
    pause
    exit /b 1
)

:: Node.js 확인
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [오류] Node.js가 설치되지 않았습니다.
    echo        https://nodejs.org/ 에서 설치하세요.
    pause
    exit /b 1
)

echo        Python OK, Node.js OK

:: ===== 2. data 디렉토리 생성 =====
echo [2/5] 데이터 디렉토리 확인...
if not exist "data\db" mkdir "data\db"
if not exist "data\uploads" mkdir "data\uploads"
if not exist "data\thumbnails" mkdir "data\thumbnails"
if not exist "data\generated" mkdir "data\generated"
echo        OK

:: ===== 3. 백엔드 의존성 =====
echo [3/5] 백엔드 의존성 확인...
cd /d "%PROJECT_ROOT%backend"
pip show fastapi >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo        패키지 설치 중... (최초 1회)
    pip install -r requirements.txt -q
    if %ERRORLEVEL% neq 0 (
        echo [오류] pip install 실패
        pause
        exit /b 1
    )
)
echo        OK

:: ===== 4. 프론트엔드 의존성 =====
echo [4/5] 프론트엔드 의존성 확인...
cd /d "%PROJECT_ROOT%frontend"
if not exist "node_modules" (
    echo        npm install 중... (최초 1회)
    npm install --silent
    if %ERRORLEVEL% neq 0 (
        echo [오류] npm install 실패
        pause
        exit /b 1
    )
)
echo        OK

:: ===== 5. 서버 시작 =====
echo [5/5] 서버 시작...
echo.
echo   백엔드:   http://localhost:8000/api/docs  (Swagger)
echo   프론트:   http://localhost:5173
echo.
echo   종료: 이 창을 닫거나 Ctrl+C
echo ============================================
echo.

:: 백엔드 시작 (별도 창)
cd /d "%PROJECT_ROOT%backend"
start "백엔드 서버 (8000)" cmd /k "title 백엔드 서버 (8000) && cd /d "%PROJECT_ROOT%backend" && python -m uvicorn app.main:app --reload --port 8000"

:: 2초 대기 (백엔드가 먼저 올라오도록)
timeout /t 2 /nobreak >nul

:: 프론트엔드 시작 (별도 창)
cd /d "%PROJECT_ROOT%frontend"
start "프론트엔드 (5173)" cmd /k "title 프론트엔드 (5173) && cd /d "%PROJECT_ROOT%frontend" && npm run dev"

:: 3초 대기 후 브라우저 열기
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo 서버가 시작되었습니다. 브라우저가 열립니다.
echo 이 창은 닫아도 됩니다.
echo.
pause
