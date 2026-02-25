FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지: 한글 폰트 + Playwright 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium 설치
RUN playwright install chromium

# 앱 코드 복사
COPY app/ ./app/

# data 디렉토리 생성
RUN mkdir -p /data/db /data/uploads/certifications /data/uploads/notices /data/uploads/pages /data/thumbnails /data/generated

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
