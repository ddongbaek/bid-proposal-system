import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Save, X, BookOpen, Loader2, Download, Upload } from 'lucide-react';
import CodeEditorPanel from '../components/editor/CodeEditorPanel';
import PreviewPanel from '../components/editor/PreviewPanel';
import Modal from '../components/common/Modal';
import { libraryApi, bidApi } from '../services/api';
import type { PageLibraryCreate } from '../types';

// 기본 HTML 템플릿
const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      font-size: 10pt;
      padding: 20mm;
      width: 210mm;
      min-height: 297mm;
    }
    h1 {
      text-align: center;
      font-size: 16pt;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td, th {
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: center;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>장표 제목</h1>
  <table>
    <thead>
      <tr>
        <th>순번</th>
        <th>성명</th>
        <th>직급</th>
        <th>자격증</th>
        <th>경력</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

export default function PageEditor() {
  const { bidId, pageId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 라이브러리에서 불러올 때 사용
  const libraryId = searchParams.get('libraryId');

  // 에디터 상태
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [cssContent, setCssContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html');

  // 미리보기에 반영되는 값 (debounce)
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewCss, setPreviewCss] = useState<string>('');

  // 저장 모달 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBid, setIsSavingBid] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  // 입찰 편집 모드 여부
  const isBidEdit = Boolean(bidId && pageId);

  // 로딩 상태
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // Debounce 타이머
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // HTML 파일 업로드용 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HWP 변환 결과를 ref로 캡처 (StrictMode 이중 실행 대응)
  const hwpDataRef = useRef<{ html: string; fileName: string } | null>(null);
  if (!hwpDataRef.current) {
    const hwpHtml = sessionStorage.getItem('hwpHtmlContent');
    const hwpFileName = sessionStorage.getItem('hwpFileName');
    if (hwpHtml) {
      hwpDataRef.current = { html: hwpHtml, fileName: hwpFileName || 'HWP 변환' };
      sessionStorage.removeItem('hwpHtmlContent');
      sessionStorage.removeItem('hwpFileName');
    }
  }

  // 입찰 장표 로드
  const loadBidPage = async (bId: string, pId: string) => {
    setIsLoadingLibrary(true);
    try {
      const page = await bidApi.getPage(Number(bId), Number(pId));
      setHtmlContent(page.html_content || '');
      setCssContent(page.css_content || '');
      setPreviewHtml(page.html_content || '');
      setPreviewCss(page.css_content || '');
      setSaveName(page.page_name || '');
    } catch {
      // sessionStorage fallback (BidWorkspace에서 넘어온 경우)
      const hwpData = hwpDataRef.current;
      if (hwpData) {
        setHtmlContent(hwpData.html);
        setCssContent('');
        setPreviewHtml(hwpData.html);
        setPreviewCss('');
        setSaveName(hwpData.fileName.replace(/\.hwp$/i, ''));
      }
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (bidId && pageId) {
      loadBidPage(bidId, pageId);
    } else if (libraryId) {
      loadFromLibrary(parseInt(libraryId));
    } else {
      const hwpData = hwpDataRef.current;
      if (hwpData) {
        setHtmlContent(hwpData.html);
        setCssContent('');
        setPreviewHtml(hwpData.html);
        setPreviewCss('');
        setSaveName(hwpData.fileName.replace(/\.hwp$/i, ''));
      } else {
        // 독립 편집기 모드 - 빈 상태에서 시작
        setHtmlContent('');
        setCssContent('');
        setPreviewHtml('');
        setPreviewCss('');
      }
    }
  }, [libraryId, bidId, pageId]);

  const loadFromLibrary = async (id: number) => {
    setIsLoadingLibrary(true);
    try {
      const item = await libraryApi.getById(id);
      setHtmlContent(item.html_content);
      setCssContent(item.css_content || '');
      setPreviewHtml(item.html_content);
      setPreviewCss(item.css_content || '');
      setSaveName(item.name);
      setSaveCategory(item.category || '');
      setSaveDescription(item.description || '');
    } catch {
      setHtmlContent(DEFAULT_HTML);
      setCssContent('');
      setPreviewHtml(DEFAULT_HTML);
      setPreviewCss('');
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // HTML 변경 시 debounce로 미리보기 반영
  const handleHtmlChange = useCallback((value: string) => {
    setHtmlContent(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPreviewHtml(value);
    }, 300);
  }, []);

  // CSS 변경 시 debounce로 미리보기 반영
  const handleCssChange = useCallback((value: string) => {
    setCssContent(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPreviewCss(value);
    }, 300);
  }, []);

  // HTML 다운로드
  const handleDownloadHtml = () => {
    // CSS가 별도로 있으면 HTML에 합쳐서 다운로드
    let fullHtml = htmlContent;
    if (cssContent && !htmlContent.includes(cssContent)) {
      const cssBlock = `<style>\n${cssContent}\n</style>`;
      if (fullHtml.includes('</head>')) {
        fullHtml = fullHtml.replace('</head>', `${cssBlock}\n</head>`);
      } else {
        fullHtml = cssBlock + '\n' + fullHtml;
      }
    }

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (saveName || '장표').replace(/[/\\?%*:|"<>]/g, '_') + '.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  // HTML 파일 업로드
  const handleUploadHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setHtmlContent(content);
        setCssContent('');
        setPreviewHtml(content);
        setPreviewCss('');
        if (!saveName) {
          setSaveName(file.name.replace(/\.html?$/i, ''));
        }
      }
    };
    reader.readAsText(file, 'utf-8');

    // input 초기화 (같은 파일 재업로드 가능하게)
    e.target.value = '';
  };

  // 입찰 장표 저장 (bidId+pageId가 있을 때)
  const handleSaveToBid = async () => {
    if (!bidId || !pageId) return;
    setIsSavingBid(true);
    try {
      await bidApi.updatePage(Number(bidId), Number(pageId), {
        html_content: htmlContent,
        css_content: cssContent || null,
        page_name: saveName || null,
      });
      navigate(`/bids/${bidId}/workspace`);
    } catch {
      alert('장표 저장에 실패했습니다.');
    } finally {
      setIsSavingBid(false);
    }
  };

  // 장표 라이브러리에 저장
  const handleSaveToLibrary = async () => {
    if (!saveName.trim()) {
      alert('장표 이름을 입력하세요.');
      return;
    }
    if (!htmlContent.trim()) {
      alert('저장할 HTML 내용이 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const data: PageLibraryCreate = {
        name: saveName.trim(),
        html_content: htmlContent,
        css_content: cssContent || undefined,
        category: saveCategory.trim() || undefined,
        description: saveDescription.trim() || undefined,
      };
      await libraryApi.create(data);
      setShowSaveModal(false);
      alert('장표가 라이브러리에 저장되었습니다.');
    } catch {
      alert('저장에 실패했습니다. API 서버 연결을 확인해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // 닫기 처리
  const handleClose = () => {
    if (htmlContent.trim() || cssContent.trim()) {
      if (!confirm('편집 중인 내용이 있습니다. 저장하지 않고 닫으시겠습니까?')) {
        return;
      }
    }
    if (bidId) {
      navigate(`/bids/${bidId}/workspace`);
    } else {
      navigate('/library');
    }
  };

  if (isLoadingLibrary) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          <span>장표를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  const ic = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="flex flex-col h-full -m-6">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-800">
            장표 편집기
            {saveName && <span className="text-gray-400 font-normal"> - {saveName}</span>}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* HTML 다운로드 */}
          <button
            onClick={handleDownloadHtml}
            disabled={!htmlContent.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            title="HTML 파일로 다운로드"
          >
            <Download size={14} />
            HTML 다운로드
          </button>
          {/* HTML 업로드 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            title="수정한 HTML 파일 업로드"
          >
            <Upload size={14} />
            HTML 업로드
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleUploadHtml}
            className="hidden"
          />
          {/* 구분선 */}
          <div className="w-px h-6 bg-gray-300" />
          {isBidEdit && (
            <button
              onClick={handleSaveToBid}
              disabled={isSavingBid}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isSavingBid ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </button>
          )}
          <button
            onClick={() => setShowSaveModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save size={14} />
            라이브러리에 저장
          </button>
          <button
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X size={14} />
            닫기
          </button>
        </div>
      </div>

      {/* 2분할 레이아웃: 코드(flex-1) | 미리보기(flex-1) */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: 코드 에디터 */}
        <div className="flex-1 min-w-0">
          <CodeEditorPanel
            htmlContent={htmlContent}
            cssContent={cssContent}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onHtmlChange={handleHtmlChange}
            onCssChange={handleCssChange}
          />
        </div>

        {/* 우측: 미리보기 */}
        <div className="flex-1 border-l border-gray-200">
          <PreviewPanel
            htmlContent={previewHtml}
            cssContent={previewCss}
          />
        </div>
      </div>

      {/* 저장 모달 */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="장표 라이브러리에 저장"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              장표 이름 *
            </label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className={ic}
              placeholder="예: 참여인력 현황표"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              분류 (카테고리)
            </label>
            <input
              type="text"
              value={saveCategory}
              onChange={(e) => setSaveCategory(e.target.value)}
              className={ic}
              placeholder="예: 인력현황, 실적, 기타"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              rows={2}
              className={ic + ' resize-none'}
              placeholder="장표에 대한 간단한 설명"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowSaveModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
            <button
              onClick={handleSaveToLibrary}
              disabled={isSaving || !saveName.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              {isSaving ? '저장중...' : '저장'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
