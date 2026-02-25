import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, X, ExternalLink, Code, Pencil, CheckSquare, Square } from 'lucide-react';
import { hwpApi } from '../services/api';

const ALLOWED_EXTENSIONS = ['.hwp'];

interface HwpSection {
  index: number;
  label: string;
}

export default function HwpConverter() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HTML 변환 결과
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  // 섹션 목록
  const [sections, setSections] = useState<HwpSection[]>([]);
  // 선택된 섹션 인덱스
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set());
  // 소스코드 보기 토글
  const [showSource, setShowSource] = useState(false);

  const resetState = () => {
    setFile(null);
    setHtmlContent(null);
    setSections([]);
    setSelectedSections(new Set());
    setError(null);
    setShowSource(false);
  };

  const validateFile = (f: File): boolean => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('지원하지 않는 파일 형식입니다. 현재 .hwp 파일만 지원합니다.');
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
      if (result.sections && result.sections.length > 0) {
        setSections(result.sections);
      }
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

  const handleOpenInEditor = () => {
    if (!htmlContent) return;
    sessionStorage.setItem('hwpHtmlContent', htmlContent);
    sessionStorage.setItem('hwpFileName', file?.name || 'HWP 변환');
    navigate('/editor');
  };

  const toggleSection = (index: number) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAllSections = () => {
    if (selectedSections.size === sections.length) {
      setSelectedSections(new Set());
    } else {
      setSelectedSections(new Set(sections.map((s) => s.index)));
    }
  };

  const handleExtractAndOpen = async () => {
    if (!file || selectedSections.size === 0) return;

    setExtractLoading(true);
    try {
      const indices = Array.from(selectedSections).sort((a, b) => a - b);
      const result = await hwpApi.extractSections(file, indices);
      sessionStorage.setItem('hwpHtmlContent', result.html_content);
      sessionStorage.setItem('hwpFileName', file.name);
      navigate('/editor');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '섹션 추출에 실패했습니다.';
      setError(msg);
    } finally {
      setExtractLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">HWP → HTML 변환</h1>
        <p className="mt-1 text-sm text-gray-500">
          HWP 파일을 HTML로 변환합니다. 서식이 여러 개면 원하는 것만 골라서 편집기로 보낼 수 있습니다.
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
                        변환 완료 ({sections.length > 0 ? `${sections.length}개 서식` : `${(htmlContent.length / 1024).toFixed(0)} KB`})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {htmlContent && (
                  <>
                    <button
                      onClick={handleOpenInEditor}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors font-medium"
                    >
                      <Pencil size={14} />
                      전체 편집기에서 열기
                    </button>
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

          {/* 섹션 선택기 */}
          {sections.length > 1 && htmlContent && !showSource && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  서식 선택 — 원하는 서식만 골라서 편집기에서 열기
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAllSections}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {selectedSections.size === sections.length ? '전체 해제' : '전체 선택'}
                  </button>
                  <button
                    onClick={handleExtractAndOpen}
                    disabled={selectedSections.size === 0 || extractLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {extractLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Pencil size={12} />
                    )}
                    선택 서식만 편집기에서 열기 ({selectedSections.size})
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sections.map((sec) => (
                  <button
                    key={sec.index}
                    onClick={() => toggleSection(sec.index)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      selectedSections.has(sec.index)
                        ? 'bg-indigo-50 border border-indigo-300 text-indigo-800'
                        : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {selectedSections.has(sec.index) ? (
                      <CheckSquare size={16} className="text-indigo-600 flex-shrink-0" />
                    ) : (
                      <Square size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      <span className="font-medium text-gray-400 mr-1">{sec.index}.</span>
                      {sec.label}
                    </span>
                  </button>
                ))}
              </div>
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
