@echo off
REM SQLite DB + 업로드 파일 백업 스크립트 (Windows)
REM 사용법: scripts\backup.bat [백업 디렉토리]

setlocal enabledelayedexpansion

set BACKUP_DIR=%~1
if "%BACKUP_DIR%"=="" set BACKUP_DIR=backups

for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_NAME=backup_%TIMESTAMP%
set BACKUP_PATH=%BACKUP_DIR%\%BACKUP_NAME%

echo === 정량제안서 시스템 백업 ===
echo 백업 위치: %BACKUP_PATH%

mkdir "%BACKUP_PATH%" 2>nul

REM 1. SQLite DB 백업
if exist "data\db\bid_proposal.db" (
    copy "data\db\bid_proposal.db" "%BACKUP_PATH%\bid_proposal.db" >nul
    echo [OK] DB 백업 완료
) else (
    echo [SKIP] DB 파일 없음
)

REM 2. 업로드 파일 백업
if exist "data\uploads" (
    xcopy "data\uploads" "%BACKUP_PATH%\uploads\" /E /I /Q >nul 2>nul
    echo [OK] 업로드 파일 백업 완료
) else (
    echo [SKIP] 업로드 파일 없음
)

REM 3. 설정 파일 백업
if exist "config" (
    xcopy "config" "%BACKUP_PATH%\config\" /E /I /Q >nul
    echo [OK] 설정 파일 백업 완료
)

echo.
echo === 백업 완료 ===
echo 폴더: %BACKUP_PATH%

endlocal
