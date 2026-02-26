import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { bidApi, libraryApi, personnelApi, pdfApi } from '../services/api';
import type {
  BidDetail,
  BidPage,
  BidPersonnel,
  PageLibrarySummary,
  PersonnelSummary,
} from '../types';
import Modal from '../components/common/Modal';

// --- Sortable Item ---
function SortablePageCard({
  page,
  isSelected,
  onSelect,
  onDelete,
  onEdit,
}: {
  page: BidPage;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
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
      {page.page_type === 'html' && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 rounded hover:bg-blue-100 text-blue-500"
          title="편집"
        >
          <Pencil size={14} />
        </button>
      )}
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

  // 자동 채움
  const [filledHtml, setFilledHtml] = useState<string | null>(null);
  const [fillPersonnelId, setFillPersonnelId] = useState<number | null>(null);
  const [filling, setFilling] = useState(false);
  const [fillStats, setFillStats] = useState<{ filled: number; remaining: string[] } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // 입찰 상세 로드
  const loadBid = useCallback(async () => {
    if (!numericBidId) return;
    try {
      const data = await bidApi.getById(numericBidId);
      setBid(data);
      if (data.pages.length > 0 && !selectedPageId) {
        setSelectedPageId(data.pages[0].id);
      }
    } catch {
      setError('입찰 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [numericBidId, selectedPageId]);

  useEffect(() => {
    loadBid();
  }, [loadBid]);

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

  // 장표 편집 (에디터로 이동)
  const handleEditPage = (page: BidPage) => {
    if (page.html_content) {
      sessionStorage.setItem('hwpHtmlContent', page.html_content);
      sessionStorage.setItem('hwpFileName', page.page_name || '장표 편집');
    }
    navigate(`/bids/${numericBidId}/pages/${page.id}/edit`);
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
      const result = await bidApi.fillPersonnel(numericBidId, selectedPage.id, fillPersonnelId);
      setFilledHtml(result.html_content);
      setFillStats({ filled: result.filled_count, remaining: result.remaining });
    } catch {
      alert('자동 채움에 실패했습니다.');
    } finally {
      setFilling(false);
    }
  };

  // 자동 채움 결과 저장
  const handleSaveFilled = async () => {
    if (!selectedPage || !fillPersonnelId || !numericBidId) return;
    try {
      await bidApi.fillPersonnel(numericBidId, selectedPage.id, fillPersonnelId, true);
      setFilledHtml(null);
      setFillStats(null);
      loadBid();
    } catch {
      alert('저장에 실패했습니다.');
    }
  };

  // 자동 채움 원본 복원
  const handleResetFilled = () => {
    setFilledHtml(null);
    setFillStats(null);
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

  // 선택된 장표
  const selectedPage = bid?.pages.find((p) => p.id === selectedPageId) || null;

  // 선택 장표 변경 시 자동 채움 상태 초기화
  useEffect(() => {
    setFilledHtml(null);
    setFillStats(null);
    setFillPersonnelId(null);
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
            </div>
          </div>

          {/* 장표 목록 (드래그앤드롭) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
                        onSelect={() => setSelectedPageId(page.id)}
                        onDelete={() => handleDeletePage(page.id)}
                        onEdit={() => handleEditPage(page)}
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

        {/* 우측: 미리보기 */}
        <div className="flex-1 bg-gray-100 flex flex-col">
          {selectedPage ? (
            selectedPage.page_type === 'html' && selectedPage.html_content ? (
              <>
                {/* 미리보기 헤더 */}
                <div className="flex items-center gap-2 px-4 py-2 bg-white border-b text-sm text-gray-600">
                  <Eye size={14} />
                  {selectedPage.page_name || '미리보기'}
                  {filledHtml && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      자동 채움 적용됨
                    </span>
                  )}
                </div>

                {/* 자동 채움 툴바 */}
                {bid.personnel.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b">
                    <UserCheck size={14} className="text-gray-500 flex-shrink-0" />
                    <select
                      value={fillPersonnelId ?? ''}
                      onChange={(e) => setFillPersonnelId(e.target.value ? Number(e.target.value) : null)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {filling ? <Loader2 size={14} className="animate-spin" /> : null}
                      채우기
                    </button>
                    {filledHtml && (
                      <>
                        <button
                          onClick={handleSaveFilled}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          저장
                        </button>
                        <button
                          onClick={handleResetFilled}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          원본
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

                {/* iframe 미리보기 */}
                <div className="flex-1">
                  <iframe
                    srcDoc={filledHtml || selectedPage.html_content}
                    className="w-full h-full bg-white"
                    title="장표 미리보기"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">{selectedPage.page_name}</p>
                  <p className="text-sm mt-1">PDF 파일은 미리보기가 지원되지 않습니다.</p>
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
    </div>
  );
}
