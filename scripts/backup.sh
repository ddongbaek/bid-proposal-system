#!/bin/bash
# SQLite DB + 업로드 파일 백업 스크립트
# 사용법: ./scripts/backup.sh [백업 디렉토리]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo "=== 정량제안서 시스템 백업 ==="
echo "백업 위치: ${BACKUP_PATH}"

mkdir -p "${BACKUP_PATH}"

# 1. SQLite DB 백업 (안전한 복사)
if [ -f "data/db/bid_proposal.db" ]; then
    sqlite3 "data/db/bid_proposal.db" ".backup '${BACKUP_PATH}/bid_proposal.db'"
    echo "[OK] DB 백업 완료"
else
    echo "[SKIP] DB 파일 없음"
fi

# 2. 업로드 파일 백업
if [ -d "data/uploads" ] && [ "$(ls -A data/uploads 2>/dev/null)" ]; then
    cp -r data/uploads "${BACKUP_PATH}/uploads"
    echo "[OK] 업로드 파일 백업 완료"
else
    echo "[SKIP] 업로드 파일 없음"
fi

# 3. 설정 파일 백업
if [ -d "config" ]; then
    cp -r config "${BACKUP_PATH}/config"
    echo "[OK] 설정 파일 백업 완료"
fi

# 4. 백업 압축
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"
cd - > /dev/null

FILESIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
echo ""
echo "=== 백업 완료 ==="
echo "파일: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz (${FILESIZE})"

# 5. 오래된 백업 정리 (30일 이상)
find "${BACKUP_DIR}" -name "backup_*.tar.gz" -mtime +30 -delete 2>/dev/null && \
    echo "30일 이상 된 백업 파일 삭제 완료" || true
