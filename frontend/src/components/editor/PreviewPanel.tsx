import { useMemo, useRef, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';

interface PreviewPanelProps {
  htmlContent: string;
  cssContent: string;
}

export default function PreviewPanel({
  htmlContent,
  cssContent,
}: PreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [containerWidth, setContainerWidth] = useState(0);

  // 컨테이너 크기 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // A4 크기(mm → px: 210mm x 297mm → 약 794px x 1123px at 96dpi)
  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  // 컨테이너 너비에 맞게 자동 스케일 계산
  useEffect(() => {
    if (containerWidth > 0) {
      const padding = 40; // 좌우 패딩
      const autoScale = Math.min((containerWidth - padding) / A4_WIDTH, 0.8);
      setScale(Math.max(autoScale, 0.2));
    }
  }, [containerWidth]);

  // iframe에 넣을 전체 HTML 문서
  const srcdoc = useMemo(() => {
    // CSS가 별도로 있으면 <style> 태그 내에 삽입
    const cssBlock = cssContent ? `<style>\n${cssContent}\n</style>` : '';

    // htmlContent가 <!DOCTYPE> 또는 <html>로 시작하면 그대로 사용
    if (htmlContent.trim().toLowerCase().startsWith('<!doctype') || htmlContent.trim().toLowerCase().startsWith('<html')) {
      // CSS를 head에 삽입
      if (cssContent) {
        return htmlContent.replace('</head>', `${cssBlock}\n</head>`);
      }
      return htmlContent;
    }

    // 부분 HTML이면 전체 문서로 래핑
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      font-size: 10pt;
      padding: 20mm;
      width: 210mm;
      min-height: 297mm;
      background: white;
      color: #000;
    }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #000; padding: 4px 6px; }
  </style>
  ${cssBlock}
</head>
<body>
${htmlContent}
</body>
</html>`;
  }, [htmlContent, cssContent]);

  const handleOpenNewWindow = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(srcdoc);
      win.document.close();
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 1.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.2));
  const handleResetZoom = () => {
    if (containerWidth > 0) {
      const padding = 40;
      const autoScale = Math.min((containerWidth - padding) / A4_WIDTH, 0.8);
      setScale(Math.max(autoScale, 0.2));
    } else {
      setScale(0.5);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-700">미리보기</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="축소"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-500 w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="확대"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="맞춤"
          >
            <RotateCcw size={16} />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button
            onClick={handleOpenNewWindow}
            disabled={!htmlContent && !cssContent}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-30"
            title="새 창에서 보기"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      {/* 미리보기 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center p-5"
        style={{ backgroundColor: '#e5e7eb' }}
      >
        {htmlContent || cssContent ? (
          <div
            style={{
              width: A4_WIDTH,
              height: A4_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              flexShrink: 0,
            }}
          >
            <iframe
              srcDoc={srcdoc}
              title="미리보기"
              style={{
                width: A4_WIDTH,
                height: A4_HEIGHT,
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                background: 'white',
              }}
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-sm">코드를 입력하면</p>
              <p className="text-sm">미리보기가 표시됩니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
