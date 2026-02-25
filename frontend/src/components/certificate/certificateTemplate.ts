export interface CertificateParams {
  certNumber: string;       // "제 2026-10호"
  name: string;
  residentNumber: string;   // 마스킹된 값 "940815-2******"
  title: string;
  hireDateFormatted: string; // "2024. 4. 1부터 현재까지"
  purpose: string;          // "공공기관 제출"
  dateFormatted: string;    // "2026년 2월 25일"
  sealImageBase64: string;
  logoImageBase64: string;
}

export function generateCertificateHTML(params: CertificateParams): string {
  const {
    certNumber,
    name,
    residentNumber,
    title,
    hireDateFormatted,
    purpose,
    dateFormatted,
    sealImageBase64,
    logoImageBase64,
  } = params;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
<title>재직 및 경력 증명서 - ${name}</title>
<style>
  @page {
    size: A4;
    margin: 0;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body {
    width: 210mm;
    height: 297mm;
    font-family: 'Pretendard', 'Malgun Gothic', '맑은 고딕', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: hidden;
  }
  body {
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .page {
    width: 210mm;
    height: 297mm;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
  }

  /* 상단 KOIS 로고 */
  .logo {
    margin-top: 18mm;
    text-align: center;
  }
  .logo img {
    display: inline-block;
  }

  /* 테두리 박스 */
  .cert-border {
    margin-top: 6mm;
    width: 170mm;
    border: 1.5px solid #333;
    padding: 10mm 16mm 10mm 16mm;
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* 좌상단 증명서 번호 */
  .cert-number {
    position: absolute;
    top: 6mm;
    left: 6mm;
    border: 1px solid #333;
    padding: 2mm 4mm;
    font-size: 10pt;
    font-weight: 500;
  }

  /* 제목 */
  .cert-title {
    text-align: center;
    font-size: 24pt;
    font-weight: 700;
    letter-spacing: 12px;
    margin-top: 12mm;
    margin-bottom: 12mm;
    color: #333;
  }

  /* 필드 영역 */
  .fields {
    padding-left: 10mm;
    flex: 1;
  }

  .field-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 8mm;
    font-size: 13pt;
    line-height: 1.6;
    white-space: nowrap;
  }

  .field-label {
    display: inline-block;
    width: 120px;
    font-weight: 400;
    color: #333;
    flex-shrink: 0;
    text-align: justify;
    text-align-last: justify;
  }

  .field-sep {
    margin: 0 16px 0 4px;
    flex-shrink: 0;
  }

  .field-value {
    color: #333;
    white-space: nowrap;
  }

  /* 중앙 증명문구 */
  .cert-statement {
    text-align: center;
    font-size: 14pt;
    letter-spacing: 4px;
    margin-top: auto;
    margin-bottom: 10mm;
    color: #333;
  }

  /* 날짜 */
  .cert-date {
    text-align: center;
    font-size: 13pt;
    margin-bottom: 8mm;
    color: #333;
    letter-spacing: 2px;
  }

  /* 대표이사 + 직인 */
  .cert-sign {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 6mm;
  }

  .cert-sign-text {
    font-size: 14pt;
    font-weight: 600;
    letter-spacing: 2px;
    color: #333;
  }

  .cert-seal {
    width: 22mm;
    height: 22mm;
    object-fit: contain;
    margin-left: -4mm;
  }

  /* 하단 주소 */
  .footer {
    width: 170mm;
    text-align: center;
    padding: 4mm 0 6mm 0;
    font-size: 9.5pt;
    color: #555;
    line-height: 1.8;
  }

  @media print {
    body {
      margin: 0;
      padding: 0;
    }
    .page {
      page-break-after: avoid;
    }
  }
</style>
</head>
<body>
<div class="page">
  <div class="logo"><img src="${logoImageBase64}" alt="KOIS" /></div>

  <div class="cert-border">
    <div class="cert-number">${certNumber}</div>

    <div class="cert-title">재직 및 경력 증명서</div>

    <div class="fields">
      <div class="field-row">
        <span class="field-label">성 명</span>
        <span class="field-sep">:</span>
        <span class="field-value">${name}</span>
      </div>
      <div class="field-row">
        <span class="field-label">주 민 등 록 번 호</span>
        <span class="field-sep">:</span>
        <span class="field-value">${residentNumber}</span>
      </div>
      <div class="field-row">
        <span class="field-label">직 위</span>
        <span class="field-sep">:</span>
        <span class="field-value">${title}</span>
      </div>
      <div class="field-row">
        <span class="field-label">재 직 기 간</span>
        <span class="field-sep">:</span>
        <span class="field-value">${hireDateFormatted}</span>
      </div>
      <div class="field-row">
        <span class="field-label">용 도</span>
        <span class="field-sep">:</span>
        <span class="field-value">${purpose}</span>
      </div>
    </div>

    <div class="cert-statement">위의 사실을 증명함.</div>

    <div class="cert-date">${dateFormatted}</div>

    <div class="cert-sign">
      <span class="cert-sign-text">㈜코이스 대표이사</span>
      <img class="cert-seal" src="${sealImageBase64}" alt="직인" />
    </div>
  </div>

  <div class="footer">
    서울특별시 강서구 마곡중앙14로 28 코이스<br/>
    02-3463-1603 / biz@kois.co.kr
  </div>
</div>
</body>
</html>`;
}
