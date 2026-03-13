import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  FilePlus,
  Upload,
  BookOpen,
  GripVertical,
  Trash2,
  Pencil,
  Loader2,
  Download,
  UserPlus,
  X,
  Users,
  Eye,
  ArrowLeft,
  UserCheck,
  FileUp,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FormInput,
  Building2,
} from 'lucide-react';
import axios from 'axios';
import { bidApi, libraryApi, personnelApi, pdfApi, hwpApi, companyApi } from '../services/api';
import type {
  BidDetail,
  BidPage,
  BidPersonnel,
  PageLibrarySummary,
  PersonnelSummary,
  CompanyInfo,
  OverlayField,
  OverlayPageInfo,
} from '../types';
import Modal from '../components/common/Modal';
import PdfOverlayEditor from '../components/pdf/PdfOverlayEditor';

// --- Sortable Item ---
function SortablePageCard({
  page,
  isSelected,
  isChecked,
  onSelect,
  onDelete,
  onEdit,
  onCheckToggle,
}: {
  page: BidPage;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onCheckToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => { e.stopPropagation(); onCheckToggle(); }}
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 flex-shrink-0"
      />
      <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
        <GripVertical size={16} />
      </button>
      <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-500">
        {page.sort_order}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {page.page_name || '(이름 없음)'}
        </p>
        <p className="text-xs text-gray-500">
          {page.page_type === 'html' ? 'HTML 장표' : 'PDF 원본'}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className={`p-1 rounded ${page.page_type === 'pdf' ? 'hover:bg-purple-100 text-purple-500' : 'hover:bg-blue-100 text-blue-500'}`}
        title={page.page_type === 'pdf' ? 'AI HTML 변환' : '편집'}
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 rounded hover:bg-red-100 text-red-400"
        title="삭제"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// --- Main Component ---
export default function BidWorkspace() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();
  const numericBidId = Number(bidId);

  const [bid, setBid] = useState<BidDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 선택된 장표 (미리보기)
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);

  // 모달
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [showPdfUploadModal, setShowPdfUploadModal] = useState(false);

  // 라이브러리 목록
  const [libraryItems, setLibraryItems] = useState<PageLibrarySummary[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // 인력 검색
  const [personnelList, setPersonnelList] = useState<PersonnelSummary[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [personnelSearch, setPersonnelSearch] = useState('');

  // PDF 생성
  const [generating, setGenerating] = useState(false);

  // PDF 업로드
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPageName, setPdfPageName] = useState('');

  // HWP 업로드
  const [hwpUploading, setHwpUploading] = useState(false);

  // HWP 채우기 (기존 COM 방식 — 호환성 유지)
  const [showHwpFillModal, setShowHwpFillModal] = useState(false);
  const [hwpFillFile, setHwpFillFile] = useState<File | null>(null);
  const [hwpFillPersonnelId, setHwpFillPersonnelId] = useState<number | null>(null);
  const [hwpFillMode, setHwpFillMode] = useState<'fill' | 'direct' | 'ai_html'>('direct');
  const [hwpFilling, setHwpFilling] = useState(false);

  // PDF 오버레이 편집기
  const [overlayEditorOpen, setOverlayEditorOpen] = useState(false);
  const [overlayPageId, setOverlayPageId] = useState<number | null>(null);
  const [overlayFields, setOverlayFields] = useState<OverlayField[]>([]);
  const [overlayPagesInfo, setOverlayPagesInfo] = useState<OverlayPageInfo[]>([]);

  // 체크박스 선택 (부분 삭제용)
  const [checkedPageIds, setCheckedPageIds] = useState<Set<number>>(new Set());

  // 미리보기 스케일
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1.0);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(0);
  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  // 플레이스홀더 입력폼
  const [showPlaceholderForm, setShowPlaceholderForm] = useState(false);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [focusedPlaceholder, setFocusedPlaceholder] = useState<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  // 원본 HTML 보존 (채우기/적용 전 상태, 저장 후에도 복원 가능)
  const [originalHtml, setOriginalHtml] = useState<string | null>(null);

  // 자동 채움
  const [filledHtml, setFilledHtml] = useState<string | null>(null);
  const [fillPersonnelId, setFillPersonnelId] = useState<number | null>(null);
  const [filling, setFilling] = useState(false);
  const [fillStats, setFillStats] = useState<{ filled: number; remaining: string[] } | null>(null);

  // 회사 기본정보
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // 입찰 상세 로드
  const loadBid = useCallback(async () => {
    if (!numericBidId) return;
    try {
      const data = await bidApi.getById(numericBidId);
      setBid(data);
      setSelectedPageId((prev) => {
        // 이전 선택이 있고 여전히 존재하면 유지, 없으면 첫 번째
        if (prev && data.pages.some((p: BidPage) => p.id === prev)) return prev;
        return data.pages.length > 0 ? data.pages[0].id : null;
      });
    } catch {
      setError('입찰 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [numericBidId]);

  useEffect(() => {
    loadBid();
  }, [loadBid]);

  // 회사 정보 로드
  useEffect(() => {
    companyApi.get().then(setCompanyInfo).catch(() => {});
  }, []);

  // 미리보기 컨테이너 크기 감지 (스케일은 수동 조절, 기본 100%)
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    setPreviewContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedPageId]);

  // 현재 선택된 장표의 HTML
  const selectedPage = bid?.pages.find((p) => p.id === selectedPageId) || null;

  // 플레이스홀더 목록 추출
  const placeholders = useMemo(() => {
    const html = filledHtml || selectedPage?.html_content || '';
    const matches = html.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    // 중복 제거
    const unique = [...new Set(matches.map((m: string) => m.replace(/\{\{|\}\}/g, '')))];
    return unique;
  }, [selectedPage?.html_content, filledHtml]);

  // iframe 내 placeholder 하이라이트
  const highlightPlaceholder = useCallback((name: string | null) => {
    setFocusedPlaceholder(name);
    const iframe = previewIframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    // 기존 하이라이트 제거
    doc.querySelectorAll('.placeholder-highlight').forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(doc.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
    if (!name) return;
    // 해당 placeholder를 찾아서 하이라이트
    const searchText = `{{${name}}}`;
    const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const matches: { node: Text; index: number }[] = [];
    let node: Text | null;
    while ((node = walk.nextNode() as Text)) {
      const idx = node.textContent?.indexOf(searchText) ?? -1;
      if (idx >= 0) matches.push({ node, index: idx });
    }
    for (const m of matches) {
      const span = doc.createElement('span');
      span.className = 'placeholder-highlight';
      span.style.cssText = 'background:#fef08a;outline:2px solid #eab308;border-radius:2px;padding:0 2px;';
      const range = doc.createRange();
      range.setStart(m.node, m.index);
      range.setEnd(m.node, m.index + searchText.length);
      range.surroundContents(span);
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // 플레이스홀더 값 적용
  const applyPlaceholders = async () => {
    if (!selectedPage) return;
    // 최초 적용 시 원본 보존
    if (!originalHtml) setOriginalHtml(selectedPage.html_content || '');
    let html = filledHtml || selectedPage.html_content || '';
    let count = 0;
    for (const [key, value] of Object.entries(placeholderValues)) {
      if (!value) continue;
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const before = html;
      html = html.replace(pattern, value);
      if (html !== before) count++;
    }
    if (count > 0) {
      setFilledHtml(html);
    }
  };

  // 플레이스홀더 값 적용 후 DB 저장
  const savePlaceholderFilled = async () => {
    if (!selectedPage || !filledHtml) return;
    try {
      await bidApi.updatePage(numericBidId, selectedPage.id, {
        html_content: filledHtml,
      });
      loadBid();
      alert('저장되었습니다.');
    } catch {
      alert('저장에 실패했습니다.');
    }
  };

  // 드래그앤드롭
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !bid || active.id === over.id) return;

    const oldIndex = bid.pages.findIndex((p) => p.id === active.id);
    const newIndex = bid.pages.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(bid.pages, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sort_order: i + 1,
    }));

    setBid({ ...bid, pages: reordered });

    try {
      await bidApi.reorderPages(numericBidId, reordered.map((p) => p.id));
    } catch {
      loadBid(); // 실패 시 원복
    }
  };

  // 라이브러리에서 장표 추가
  const handleAddFromLibrary = async (item: PageLibrarySummary) => {
    try {
      const detail = await libraryApi.getById(item.id);
      await bidApi.addPageHtml(numericBidId, {
        page_name: detail.name,
        html_content: detail.html_content,
        css_content: detail.css_content,
      });
      setShowLibraryModal(false);
      loadBid();
    } catch {
      alert('장표 추가에 실패했습니다.');
    }
  };

  // PDF 업로드
  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    try {
      await bidApi.addPagePdf(numericBidId, pdfFile, pdfPageName || pdfFile.name);
      setShowPdfUploadModal(false);
      setPdfFile(null);
      setPdfPageName('');
      loadBid();
    } catch {
      alert('PDF 업로드에 실패했습니다.');
    }
  };

  // HWP 페이지 분리 업로드
  const handleHwpUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.hwp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setHwpUploading(true);
      try {
        const result = await hwpApi.toPages(file, numericBidId);
        alert(result.message);
        loadBid();
      } catch (err) {
        const msg = axios.isAxiosError(err) && err.response?.data?.detail
          ? err.response.data.detail
          : err instanceof Error ? err.message : 'HWP 변환에 실패했습니다.';
        alert(`HWP 변환 실패: ${msg}`);
      } finally {
        setHwpUploading(false);
      }
    };
    input.click();
  };

  // 인력 배정
  const handleAddPersonnel = async (personnelId: number) => {
    try {
      await bidApi.addPersonnel(numericBidId, { personnel_id: personnelId });
      setShowPersonnelModal(false);
      loadBid();
    } catch {
      alert('인력 배정에 실패했습니다. 이미 배정된 인력일 수 있습니다.');
    }
  };

  // 인력 해제
  const handleRemovePersonnel = async (assignmentId: number) => {
    if (!confirm('이 인력의 배정을 해제하시겠습니까?')) return;
    try {
      await bidApi.removePersonnel(numericBidId, assignmentId);
      loadBid();
    } catch {
      alert('인력 배정 해제에 실패했습니다.');
    }
  };

  // 장표 삭제
  const handleDeletePage = async (pageId: number) => {
    if (!confirm('이 장표를 삭제하시겠습니까?')) return;
    try {
      await bidApi.deletePage(numericBidId, pageId);
      if (selectedPageId === pageId) setSelectedPageId(null);
      loadBid();
    } catch {
      alert('장표 삭제에 실패했습니다.');
    }
  };

  // 장표 전체 삭제
  const handleDeleteAllPages = async () => {
    if (!bid || bid.pages.length === 0) return;
    if (!confirm(`장표 ${bid.pages.length}개를 모두 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(bid.pages.map((p) => bidApi.deletePage(numericBidId, p.id)));
      setSelectedPageId(null);
      setCheckedPageIds(new Set());
      loadBid();
    } catch {
      alert('일부 장표 삭제에 실패했습니다.');
      loadBid();
    }
  };

  // 선택된 장표 삭제
  const handleDeleteChecked = async () => {
    if (checkedPageIds.size === 0) return;
    if (!confirm(`선택한 ${checkedPageIds.size}개 장표를 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(
        Array.from(checkedPageIds).map((id) => bidApi.deletePage(numericBidId, id))
      );
      if (selectedPageId && checkedPageIds.has(selectedPageId)) setSelectedPageId(null);
      setCheckedPageIds(new Set());
      loadBid();
    } catch {
      alert('일부 장표 삭제에 실패했습니다.');
      setCheckedPageIds(new Set());
      loadBid();
    }
  };

  // 체크 토글
  const toggleCheck = (pageId: number) => {
    setCheckedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  // 전체 선택/해제
  const toggleCheckAll = () => {
    if (!bid) return;
    if (checkedPageIds.size === bid.pages.length) {
      setCheckedPageIds(new Set());
    } else {
      setCheckedPageIds(new Set(bid.pages.map((p) => p.id)));
    }
  };

  // PDF 장표 → AI HTML 변환 (개별 페이지)
  const [convertingPageId, setConvertingPageId] = useState<number | null>(null);
  const handleConvertToHtml = async (page: BidPage) => {
    if (!confirm('이 PDF 장표를 AI HTML로 변환하시겠습니까?\n변환 후 편집기에서 수정 + 자동채움이 가능합니다.\n(10~30초 소요)')) return;
    setConvertingPageId(page.id);
    try {
      const result = await hwpApi.convertPageToHtml(page.id);
      alert(result.message);
      await loadBid();
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.detail
        ? err.response.data.detail
        : 'AI HTML 변환에 실패했습니다.';
      alert(msg);
    } finally {
      setConvertingPageId(null);
    }
  };

  // 장표 편집 (에디터로 이동 또는 오버레이 편집기 열기)
  const handleEditPage = async (page: BidPage) => {
    // PDF 장표 → AI HTML 변환 제안
    if (page.page_type === 'pdf') {
      handleConvertToHtml(page);
      return;
    }
    // HTML 장표 → 코드 에디터
    if (page.html_content) {
      sessionStorage.setItem('hwpHtmlContent', page.html_content);
      sessionStorage.setItem('hwpFileName', page.page_name || '장표 편집');
    }
    navigate(`/bids/${numericBidId}/pages/${page.id}/edit`);
  };

  // HWP → COM PDF → 페이지별 분리 → 장표 추가
  const handleHwpFillUpload = async () => {
    if (!hwpFillFile) return;
    setHwpFilling(true);
    try {
      if (hwpFillMode === 'ai_html') {
        // AI HTML 변환 모드: HWP → COM PDF → Gemini AI → HTML 장표
        const result = await hwpApi.toHtmlPages(hwpFillFile, numericBidId);
        setShowHwpFillModal(false);
        setHwpFillFile(null);
        setHwpFillPersonnelId(null);
        alert(result.message);
        await loadBid();
      } else {
        // 기존 모드: direct/fill
        const result = await hwpApi.fillToPages(
          hwpFillFile, numericBidId,
          hwpFillPersonnelId || undefined,
          hwpFillMode,
        );
        setShowHwpFillModal(false);
        setHwpFillFile(null);
        setHwpFillPersonnelId(null);
        alert(result.message);
        await loadBid();
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.detail
        ? err.response.data.detail
        : err instanceof Error ? err.message : 'HWP 변환에 실패했습니다.';
      alert(`HWP 변환 실패: ${msg}`);
    } finally {
      setHwpFilling(false);
    }
  };

  // 최종 PDF 생성
  const handleGeneratePdf = async () => {
    setGenerating(true);
    try {
      const blob = await pdfApi.merge(numericBidId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bid?.bid_name || 'bid'}_proposal.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF 생성에 실패했습니다. 장표가 있는지, Playwright가 설치되어 있는지 확인하세요.');
    } finally {
      setGenerating(false);
    }
  };

  // 인력 자동 채움
  const handleFillPersonnel = async () => {
    if (!selectedPage || !fillPersonnelId || !numericBidId) return;
    setFilling(true);
    try {
      // 최초 채우기 시 원본 보존
      if (!originalHtml) setOriginalHtml(selectedPage.html_content || '');
      const result = await bidApi.fillPersonnel(numericBidId, selectedPage.id, fillPersonnelId);
      setFilledHtml(result.html_content);
      setFillStats({ filled: result.filled_count, remaining: result.remaining });
    } catch {
      alert('자동 채움에 실패했습니다.');
    } finally {
      setFilling(false);
    }
  };

  // 전체 인력 한번에 채우기 (다수 인력 테이블용)
  const handleFillAllPersonnel = async () => {
    if (!selectedPage || !numericBidId) return;
    setFilling(true);
    try {
      if (!originalHtml) setOriginalHtml(selectedPage.html_content || '');
      const result = await bidApi.fillAllPersonnel(numericBidId, selectedPage.id);
      setFilledHtml(result.html_content);
      setFillStats({ filled: result.filled_count, remaining: result.remaining });
    } catch {
      alert('전체 인력 채우기에 실패했습니다.');
    } finally {
      setFilling(false);
    }
  };

  // 자동 채움 결과 저장
  const handleSaveFilled = async () => {
    if (!selectedPage || !filledHtml || !numericBidId) return;
    try {
      // 채움 결과 HTML을 직접 저장
      await bidApi.updatePage(numericBidId, selectedPage.id, {
        html_content: filledHtml,
      });
      setFilledHtml(null);
      setFillStats(null);
      loadBid();
    } catch {
      alert('저장에 실패했습니다.');
    }
  };

  // 자동 채움 원본 복원
  const handleResetFilled = async () => {
    if (originalHtml && numericBidId && selectedPage) {
      // DB에 이미 저장했더라도 원본으로 되돌림
      try {
        await bidApi.updatePage(numericBidId, selectedPage.id, {
          html_content: originalHtml,
        });
        loadBid();
      } catch {
        // DB 복원 실패해도 UI는 원본으로
      }
    }
    setFilledHtml(null);
    setFillStats(null);
    setOriginalHtml(null);
    setPlaceholderValues({});
  };

  // 회사정보 + 입찰정보 자동 채움 (클라이언트 사이드)
  const handleFillCompany = async () => {
    if (!selectedPage || !bid) return;
    if (!originalHtml) setOriginalHtml(selectedPage.html_content || '');
    let html = filledHtml || selectedPage.html_content || '';
    let count = 0;

    // 입찰 정보 치환 (공고번호, 공고명, 발주처)
    const bidFields: Record<string, string | null | undefined> = {
      bid_number: bid.bid_number,
      bid_name: bid.bid_name,
      client_name: bid.client_name,
    };
    for (const [key, value] of Object.entries(bidFields)) {
      if (value == null) continue;
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const before = html;
      html = html.replace(pattern, String(value));
      if (html !== before) count++;
    }

    // 회사정보 치환
    if (companyInfo) {
      const fields: (keyof CompanyInfo)[] = [
        'company_name', 'business_number', 'corporate_number',
        'representative', 'representative_birth', 'address', 'zip_code',
        'phone', 'fax', 'email', 'website',
        'business_type', 'business_category', 'establishment_date',
        'capital', 'employee_count',
      ];
      for (const field of fields) {
        const value = companyInfo[field];
        if (value == null) continue;
        const pattern = new RegExp(`\\{\\{${field}\\}\\}`, 'g');
        const before = html;
        html = html.replace(pattern, String(value));
        if (html !== before) count++;
      }

      // 인감도장 오버레이: (인) 텍스트 위에 이미지 삽입
      if (companyInfo.seal_image) {
        try {
          const resp = await fetch(companyApi.imageUrl('seal_image'));
          if (resp.ok) {
            const blob = await resp.blob();
            const dataUri = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            const sealImg = `<img src="${dataUri}" alt="인감" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:70px; height:70px; object-fit:contain; opacity:0.85; pointer-events:none;">`;
            const sealPattern = /\(\s*인\s*\)|\(\s*印\s*\)/g;
            const beforeSeal = html;
            html = html.replace(sealPattern, (m) =>
              `<span style="position:relative; display:inline-block;">${m}${sealImg}</span>`
            );
            if (html !== beforeSeal) count++;
          }
        } catch {
          // 인감 이미지 로드 실패 — 무시
        }
      }
    }

    if (count > 0) {
      setFilledHtml(html);
      const remainingVars = [...html.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
      const unique = [...new Set(remainingVars)];
      setFillStats({ filled: count, remaining: unique });
    }
  };

  // 라이브러리 모달 열기
  const openLibraryModal = async () => {
    setShowLibraryModal(true);
    setLibraryLoading(true);
    try {
      const items = await libraryApi.list();
      setLibraryItems(items);
    } catch {
      setLibraryItems([]);
    } finally {
      setLibraryLoading(false);
    }
  };

  // 인력 모달 열기
  const openPersonnelModal = async () => {
    setShowPersonnelModal(true);
    setPersonnelLoading(true);
    try {
      const result = await personnelApi.list({ size: 100 });
      setPersonnelList(result.items);
    } catch {
      setPersonnelList([]);
    } finally {
      setPersonnelLoading(false);
    }
  };

  // 선택 장표 변경 시 자동 채움/플레이스홀더 상태 초기화
  useEffect(() => {
    setFilledHtml(null);
    setFillStats(null);
    setFillPersonnelId(null);
    setPlaceholderValues({});
    setShowPlaceholderForm(false);
  }, [selectedPageId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (error || !bid) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || '입찰을 찾을 수 없습니다.'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/bids')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{bid.bid_name}</h1>
            <p className="text-xs text-gray-500">
              {bid.client_name && `${bid.client_name} · `}
              {bid.pages.length}개 장표 · {bid.personnel.length}명 배정
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHwpFillModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <FileUp size={16} />
            HWP 추가
          </button>
          <button
            onClick={handleGeneratePdf}
            disabled={generating || bid.pages.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            PDF 생성
          </button>
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 장표 패널 */}
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          {/* 장표 추가 버튼들 */}
          <div className="p-3 border-b space-y-1">
            <div className="flex gap-1">
              <button
                onClick={openLibraryModal}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <BookOpen size={14} />
                라이브러리
              </button>
              <button
                onClick={() => {
                  navigate('/editor');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <FilePlus size={14} />
                새 장표
              </button>
              <button
                onClick={() => setShowPdfUploadModal(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
              >
                <Upload size={14} />
                PDF
              </button>
              <button
                onClick={handleHwpUpload}
                disabled={hwpUploading}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 disabled:opacity-50 transition-colors"
              >
                {hwpUploading ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                {hwpUploading ? '변환중...' : 'HWP'}
              </button>
            </div>
          </div>

          {/* 장표 목록 (드래그앤드롭) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {bid.pages.length > 0 && (
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bid.pages.length > 0 && checkedPageIds.size === bid.pages.length}
                    onChange={toggleCheckAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                  />
                  {bid.pages.length}개 장표
                </label>
                <div className="flex items-center gap-2">
                  {checkedPageIds.size > 0 && (
                    <button
                      onClick={handleDeleteChecked}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      선택 삭제 ({checkedPageIds.size})
                    </button>
                  )}
                  <button
                    onClick={handleDeleteAllPages}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    전체 삭제
                  </button>
                </div>
              </div>
            )}
            {bid.pages.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <FileText className="mx-auto mb-2" size={32} />
                장표를 추가하세요
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={bid.pages.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {bid.pages
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((page) => (
                      <SortablePageCard
                        key={page.id}
                        page={page}
                        isSelected={page.id === selectedPageId}
                        isChecked={checkedPageIds.has(page.id)}
                        onSelect={() => setSelectedPageId(page.id)}
                        onDelete={() => handleDeletePage(page.id)}
                        onEdit={() => handleEditPage(page)}
                        onCheckToggle={() => toggleCheck(page.id)}
                      />
                    ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* 인력 배정 섹션 */}
          <div className="border-t p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Users size={14} />
                배정 인력 ({bid.personnel.length})
              </h3>
              <button
                onClick={openPersonnelModal}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
              >
                <UserPlus size={12} />
                추가
              </button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {bid.personnel.map((bp: BidPersonnel) => (
                <div
                  key={bp.id}
                  className="flex items-center justify-between px-2 py-1 bg-white rounded border text-xs"
                >
                  <span>
                    <span className="font-medium">{bp.personnel_name}</span>
                    {bp.role_in_bid && (
                      <span className="ml-1 text-gray-400">({bp.role_in_bid})</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemovePersonnel(bp.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 우측: 미리보기 + 입력폼 */}
        <div className="flex-1 bg-gray-100 flex flex-col">
          {selectedPage ? (
            selectedPage.page_type === 'html' && selectedPage.html_content ? (
              <>
                {/* 미리보기 헤더 + 줌 컨트롤 */}
                <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Eye size={14} />
                    {selectedPage.page_name || '미리보기'}
                    {filledHtml && (
                      <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        채움 적용
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {placeholders.length > 0 && (
                      <button
                        onClick={() => setShowPlaceholderForm(!showPlaceholderForm)}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                          showPlaceholderForm ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                        title="입력폼"
                      >
                        <FormInput size={14} />
                        입력폼 ({placeholders.length})
                      </button>
                    )}
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button onClick={() => setPreviewScale((s) => Math.max(s - 0.1, 0.2))} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="축소">
                      <ZoomOut size={14} />
                    </button>
                    <span className="text-xs text-gray-500 w-10 text-center">{Math.round(previewScale * 100)}%</span>
                    <button onClick={() => setPreviewScale((s) => Math.min(s + 0.1, 1.5))} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="확대">
                      <ZoomIn size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const el = previewContainerRef.current;
                        if (el) {
                          const scaleW = (el.clientWidth - 40) / A4_WIDTH;
                          setPreviewScale(Math.max(Math.min(scaleW, 1.0), 0.3));
                        }
                      }}
                      className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="맞춤"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                {/* 자동 채움 툴바 */}
                {(bid.personnel.length > 0 || companyInfo) && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 border-b">
                    {bid.personnel.length > 0 && (
                      <>
                        <UserCheck size={14} className="text-gray-500 flex-shrink-0" />
                        <select
                          value={fillPersonnelId ?? ''}
                          onChange={(e) => setFillPersonnelId(e.target.value ? Number(e.target.value) : null)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">인력 선택...</option>
                          {bid.personnel.map((bp: BidPersonnel) => (
                            <option key={bp.personnel_id} value={bp.personnel_id}>
                              {bp.personnel_name}
                              {bp.role_in_bid ? ` (${bp.role_in_bid})` : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleFillPersonnel}
                          disabled={!fillPersonnelId || filling}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
                        >
                          {filling ? <Loader2 size={12} className="animate-spin" /> : '채우기'}
                        </button>
                        <button
                          onClick={handleFillAllPersonnel}
                          disabled={filling}
                          className="px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-40 transition-colors"
                          title="배정된 전체 인력을 테이블에 한번에 채움"
                        >
                          {filling ? <Loader2 size={12} className="animate-spin" /> : '전체 채우기'}
                        </button>
                      </>
                    )}
                    <>
                      {bid.personnel.length > 0 && <div className="w-px h-4 bg-gray-300" />}
                      <button
                        onClick={handleFillCompany}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        <Building2 size={12} />
                        회사정보
                      </button>
                    </>
                    {(filledHtml || originalHtml) && (
                      <>
                        <div className="w-px h-4 bg-gray-300" />
                        {filledHtml && (
                          <button onClick={handleSaveFilled} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                            저장
                          </button>
                        )}
                        <button onClick={handleResetFilled} className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors font-medium">
                          원본 복원
                        </button>
                      </>
                    )}
                    {fillStats && (
                      <span className="ml-auto text-xs text-gray-500">
                        {fillStats.filled}개 치환
                        {fillStats.remaining.length > 0 && (
                          <span className="text-amber-600"> / {fillStats.remaining.length}개 미치환</span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* 미리보기 + 플레이스홀더 입력폼 */}
                <div className="flex-1 flex overflow-hidden">
                  {/* A4 미리보기 (스케일 적용) */}
                  <div
                    ref={previewContainerRef}
                    className="flex-1 overflow-auto"
                    style={{ backgroundColor: '#e5e7eb', padding: 20 }}
                  >
                    <div
                      style={{
                        width: A4_WIDTH * previewScale,
                        height: A4_HEIGHT * previewScale,
                        margin: '0 auto',
                      }}
                    >
                      <iframe
                        ref={previewIframeRef}
                        srcDoc={(() => {
                          const html = filledHtml || selectedPage.html_content || '';
                          // 항상 최종 A4 레이아웃 CSS 주입 (기존/신규 장표 모두 대응)
                          const layoutCss = '<style>@import url("https://cdn.jsdelivr.net/gh/nickcernis/batang-nanum-webfont/stylesheet.css");body{width:210mm!important;min-height:297mm!important;box-sizing:border-box!important;background:#fff!important;padding:15mm 20mm!important;margin:0 auto!important;font-family:"Batang","바탕","바탕체","Nanum Myeongjo",serif!important;font-size:10pt!important;line-height:1.6!important}td,th,p,span,div,li{font-family:inherit!important}table{border:2px solid #000!important;border-collapse:collapse!important;width:100%!important}td,th{border:1px solid #000!important}.Paper{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important}.TableControl{margin:0 auto!important}</style><script>document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll(".TableControl").forEach(function(el){if(!el.textContent.replace(/[\u00a0\s]/g,""))el.remove()});var pns=document.body.querySelectorAll("p,div,span");pns.forEach(function(el){if(/^\\s*-\\s*\\d+\\s*-\\s*$/.test(el.textContent))el.remove()})});</script>';
                          if (html.includes('</head>')) {
                            return html.replace('</head>', layoutCss + '</head>');
                          }
                          if (html.includes('<body')) {
                            return layoutCss + html;
                          }
                          return html;
                        })()}
                        style={{
                          width: A4_WIDTH,
                          height: A4_HEIGHT,
                          border: 'none',
                          background: 'white',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                        }}
                        title="장표 미리보기"
                      />
                    </div>
                  </div>

                  {/* 플레이스홀더 입력폼 사이드패널 */}
                  {showPlaceholderForm && placeholders.length > 0 && (
                    <div className="w-72 border-l bg-white flex flex-col overflow-hidden">
                      <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">빈칸 입력</span>
                        <div className="flex gap-1">
                          <button
                            onClick={applyPlaceholders}
                            className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            적용
                          </button>
                          {(filledHtml || originalHtml) && (
                            <>
                              {filledHtml && (
                                <button
                                  onClick={savePlaceholderFilled}
                                  className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  저장
                                </button>
                              )}
                              <button
                                onClick={handleResetFilled}
                                className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                              >
                                원본</button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        <div className="text-xs text-gray-400 mb-1">
                          {placeholders.length}개 미치환 / 클릭 시 위치 표시
                        </div>
                        {placeholders.map((name) => (
                          <div key={name}>
                            <label className="block text-xs text-gray-600 mb-0.5">{`{{${name}}}`}</label>
                            <input
                              type="text"
                              value={placeholderValues[name] || ''}
                              onChange={(e) => setPlaceholderValues((prev) => ({ ...prev, [name]: e.target.value }))}
                              onFocus={() => highlightPlaceholder(name)}
                              onBlur={() => highlightPlaceholder(null)}
                              placeholder={name}
                              className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                focusedPlaceholder === name ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : selectedPage.page_type === 'pdf' ? (
              <>
                <div className="flex items-center gap-2 px-4 py-2 bg-white border-b text-sm text-gray-600">
                  <Eye size={14} />
                  {selectedPage.page_name || 'PDF 미리보기'}
                </div>
                <div className="flex-1">
                  <iframe
                    src={`/api/bids/${numericBidId}/pages/${selectedPage.id}/pdf-preview`}
                    className="w-full h-full"
                    title="PDF 미리보기"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">{selectedPage.page_name}</p>
                  <p className="text-sm mt-1">미리보기를 지원하지 않는 장표입니다.</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Eye size={48} className="mx-auto mb-3" />
                <p>장표를 선택하면 미리보기가 표시됩니다</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 라이브러리 모달 */}
      <Modal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        title="라이브러리에서 장표 추가"
      >
        {libraryLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        ) : libraryItems.length === 0 ? (
          <p className="text-center py-8 text-gray-500">저장된 장표가 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {libraryItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAddFromLibrary(item)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <FileText size={20} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {item.category && (
                    <p className="text-xs text-gray-500">{item.category}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* 인력 배정 모달 */}
      <Modal
        isOpen={showPersonnelModal}
        onClose={() => setShowPersonnelModal(false)}
        title="인력 배정"
      >
        <div className="mb-3">
          <input
            type="text"
            placeholder="이름으로 검색..."
            value={personnelSearch}
            onChange={(e) => setPersonnelSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {personnelLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {personnelList
              .filter((p) =>
                !personnelSearch || p.name.includes(personnelSearch)
              )
              .map((p) => {
                const alreadyAssigned = bid.personnel.some(
                  (bp) => bp.personnel_id === p.id
                );
                return (
                  <button
                    key={p.id}
                    onClick={() => !alreadyAssigned && handleAddPersonnel(p.id)}
                    disabled={alreadyAssigned}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm ${
                      alreadyAssigned
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'hover:bg-blue-50 border border-gray-200'
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.title && <span className="text-gray-500">{p.title}</span>}
                    {p.department && <span className="text-gray-400">{p.department}</span>}
                    {alreadyAssigned && (
                      <span className="ml-auto text-xs text-gray-400">배정됨</span>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </Modal>

      {/* PDF 업로드 모달 */}
      <Modal
        isOpen={showPdfUploadModal}
        onClose={() => { setShowPdfUploadModal(false); setPdfFile(null); setPdfPageName(''); }}
        title="PDF 파일 업로드"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">장표 이름</label>
            <input
              type="text"
              value={pdfPageName}
              onChange={(e) => setPdfPageName(e.target.value)}
              placeholder="예: 사업자등록증"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PDF 파일</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
          <button
            onClick={handlePdfUpload}
            disabled={!pdfFile}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            업로드
          </button>
        </div>
      </Modal>

      {/* HWP → 장표 추가 모달 */}
      <Modal
        isOpen={showHwpFillModal}
        onClose={() => { setShowHwpFillModal(false); setHwpFillFile(null); setHwpFillPersonnelId(null); setHwpFillMode('direct'); }}
        title="HWP → 장표 추가"
      >
        <div className="space-y-4">
          {/* 파일 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HWP 파일</label>
            <label className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              hwpFillFile
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-blue-400 hover:bg-blue-50'
            }`}>
              <FileUp size={18} />
              <span className="text-sm font-medium">
                {hwpFillFile ? hwpFillFile.name : '파일 선택 (.hwp, .hwpx)'}
              </span>
              <input
                type="file"
                accept=".hwp,.hwpx"
                onChange={(e) => setHwpFillFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {/* 모드 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">변환 방식</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHwpFillMode('direct')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  hwpFillMode === 'direct'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                바로 변환
                <p className="text-xs font-normal mt-0.5 opacity-70">PDF 그대로</p>
              </button>
              <button
                type="button"
                onClick={() => setHwpFillMode('fill')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  hwpFillMode === 'fill'
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                자동 치환
                <p className="text-xs font-normal mt-0.5 opacity-70">{'{{placeholder}}'}</p>
              </button>
              <button
                type="button"
                onClick={() => setHwpFillMode('ai_html')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  hwpFillMode === 'ai_html'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                AI 편집용
                <p className="text-xs font-normal mt-0.5 opacity-70">HTML 변환</p>
              </button>
            </div>
          </div>

          {/* 자동 치환 모드: 인력 선택 */}
          {hwpFillMode === 'fill' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">인력 선택 (선택사항)</label>
                <select
                  value={hwpFillPersonnelId || ''}
                  onChange={(e) => setHwpFillPersonnelId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">회사정보만 채우기</option>
                  {bid?.personnel.map((bp) => (
                    <option key={bp.id} value={bp.personnel_id}>
                      {bp.personnel_name} {bp.role_in_bid ? `(${bp.role_in_bid})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">치환 항목:</p>
                <p>· 회사: {'{{company_name}}'}, {'{{representative}}'}, {'{{business_number}}'}, {'{{address}}'} 등</p>
                <p>· 입찰: {'{{bid_name}}'}, {'{{bid_number}}'}, {'{{client_name}}'}</p>
                <p>· 인력: {'{{name}}'}, {'{{department}}'}, {'{{title}}'}, {'{{cert_1_name}}'} 등</p>
              </div>
            </>
          )}

          {/* 안내 */}
          {hwpFillMode === 'ai_html' ? (
            <div className="bg-purple-50 rounded-lg p-3 text-xs text-purple-700 space-y-1">
              <p className="font-medium">AI HTML 변환:</p>
              <p>1. 한글 → PDF 변환 (COM, 서식 유지)</p>
              <p>2. 페이지별 Gemini AI → HTML 변환</p>
              <p>3. 빈칸에 {'{{placeholder}}'} 자동 삽입</p>
              <p>4. 편집기에서 수정 + 자동채움 가능</p>
              <p className="text-purple-500 mt-1">※ AI 변환에 페이지당 10~30초 소요</p>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">처리 과정:</p>
              <p>1. 한글에서 PDF로 변환 (서식 100% 유지)</p>
              <p>2. 페이지별 분리 → 장표 목록에 추가</p>
              <p>3. 불필요한 페이지 삭제 후, 편집 버튼으로 자동채움/수정</p>
            </div>
          )}

          <button
            onClick={handleHwpFillUpload}
            disabled={!hwpFillFile || hwpFilling}
            className={`w-full py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              hwpFillMode === 'ai_html'
                ? 'bg-purple-600 hover:bg-purple-700'
                : hwpFillMode === 'direct'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {hwpFilling ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {hwpFillMode === 'ai_html' ? '변환 중... (AI HTML 처리)' : '변환 중... (한글 COM 처리)'}
              </>
            ) : (
              <>
                <FileUp size={16} />
                {hwpFillMode === 'ai_html'
                  ? 'AI HTML 변환 & 장표 추가'
                  : hwpFillMode === 'direct'
                    ? 'PDF 변환 & 장표 추가'
                    : '치환 & 장표 추가'}
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* PDF 오버레이 편집기 */}
      {overlayEditorOpen && overlayPageId && (
        <PdfOverlayEditor
          pageId={overlayPageId}
          fields={overlayFields}
          pagesInfo={overlayPagesInfo}
          onSave={() => {
            setOverlayEditorOpen(false);
            setOverlayPageId(null);
            loadBid();
          }}
          onClose={() => {
            setOverlayEditorOpen(false);
            setOverlayPageId(null);
          }}
        />
      )}
    </div>
  );
}
