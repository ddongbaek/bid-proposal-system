FROM python:3.11-slim

WORKDIR /app

# 한글 폰트 (Phase 4에서 Noto Sans KR 추가 예정)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# data 디렉토리 생성
RUN mkdir -p /data/db /data/uploads/certifications /data/uploads/notices /data/uploads/pages /data/thumbnails /data/generated

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
