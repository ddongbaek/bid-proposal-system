import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Loader2, X, ExternalLink, Code } from 'lucide-react';
import { hwpApi } from '../services/api';

const ALLOWED_EXTENSIONS = ['.hwp'];

export default function HwpConverter() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HTML 변환 결과
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  // 소스코드 보기 토글
  const [showSource, setShowSource] = useState(false);

  const resetState = () => {
    setFile(null);
    setHtmlContent(null);
    setError(null);
    setShowSource(false);
  };

  const validateFile = (f: File): boolean => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`지원하지 않는 파일 형식입니다. 현재 .hwp 파일만 지원합니다.`);
      return false;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('파일 크기가 50MB를 초과합니다.');
      return false;
    }
    return true;
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!validateFile(selectedFile)) return;

    resetState();
    setFile(selectedFile);
    setError(null);
    setConvertLoading(true);

    try {
      const result = await hwpApi.toHtml(selectedFile);
      setHtmlContent(result.html_content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'HTML 변환에 실패했습니다.';
      setError(msg);
    } finally {
      setConvertLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleOpenNewWindow = () => {
    if (!htmlContent) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlContent);
      win.document.close();
    }
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">HWP → HTML 변환</h1>
        <p className="mt-1 text-sm text-gray-500">
          HWP 파일을 HTML로 변환하여 양식 구조를 확인합니다. 변환된 HTML은 편집기에서 수정 가능합니다.
        </p>
      </div>

      {/* 파일 업로드 */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer
                     hover:border-blue-400 hover:bg-blue-50/50 transition-colors max-w-2xl mx-auto"
        >
          <Upload className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-lg font-medium text-gray-700">
            HWP 파일을 드래그하거나 클릭하여 선택
          </p>
          <p className="mt-2 text-sm text-gray-500">
            .hwp 파일만 지원 (최대 50MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".hwp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* 파일 정보 + 컨트롤 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(0)} KB
                    {convertLoading && (
                      <span className="ml-2 text-blue-600">
                        <Loader2 className="inline animate-spin" size={14} /> 변환 중...
                      </span>
                    )}
                    {htmlContent && !convertLoading && (
                      <span className="ml-2 text-green-600 font-medium">
                        변환 완료 ({(htmlContent.length / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {htmlContent && (
                  <>
                    <button
                      onClick={handleOpenNewWindow}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink size={14} />
                      새 창
                    </button>
                    <button
                      onClick={() => setShowSource(!showSource)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        showSource
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Code size={14} />
                      소스
                    </button>
                  </>
                )}
                <button
                  onClick={resetState}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="다른 파일 선택"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* HTML 소스코드 */}
          {showSource && htmlContent && (
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto" style={{ maxHeight: '80vh' }}>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap break-all">
                {htmlContent}
              </pre>
            </div>
          )}

          {/* HTML 미리보기 */}
          {htmlContent && !showSource && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <iframe
                srcDoc={htmlContent}
                className="w-full bg-white"
                style={{ height: '80vh' }}
                title="HTML 변환 결과"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
