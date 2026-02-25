import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, BookOpen, Filter } from 'lucide-react';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { libraryApi } from '../services/api';
import type { PageLibrarySummary } from '../types';

// Mock 데이터 (API 미연결 시 fallback)
const mockLibrary: PageLibrarySummary[] = [
  {
    id: 1,
    name: '참여인력 현황표',
    category: '인력현황',
    description: '기본 인력현황표 양식',
    created_at: '2026-02-24T10:00:00',
  },
  {
    id: 2,
    name: '경력증명서',
    category: '기타',
    description: '개인별 경력증명서 양식',
    created_at: '2026-02-24T11:00:00',
  },
  {
    id: 3,
    name: '실적증명서',
    category: '실적',
    description: '유사실적 증명서 양식',
    created_at: '2026-02-24T12:00:00',
  },
];

export default function Library() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PageLibrarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<PageLibrarySummary | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await libraryApi.list();
      setItems(data);
      setUsingMock(false);
    } catch {
      // API 미연결 시 mock 데이터 사용
      setItems(mockLibrary);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  // 카테고리 목록 추출
  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [items]);

  // 필터링된 아이템
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const handleDelete = async (item: PageLibrarySummary) => {
    try {
      await libraryApi.delete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      // mock 모드에서도 삭제 동작
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
    setDeleteTarget(null);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  // 카테고리별 배지 색상
  const getCategoryColor = (category: string | null) => {
    if (!category) return 'bg-gray-100 text-gray-600';
    const colors: Record<string, string> = {
      '인력현황': 'bg-blue-100 text-blue-700',
      '실적': 'bg-green-100 text-green-700',
      '기타': 'bg-gray-100 text-gray-600',
    };
    return colors[category] || 'bg-purple-100 text-purple-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-800">장표 보관함</h2>
          <span className="text-sm text-gray-400">({filteredItems.length}개)</span>
        </div>
        <button
          onClick={() => navigate('/editor')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          새 장표
        </button>
      </div>

      {/* Mock 데이터 알림 */}
      {usingMock && (
        <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          API 서버에 연결되지 않아 예시 데이터를 표시합니다.
        </div>
      )}

      {/* 카테고리 필터 */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500">분류:</span>
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              !selectedCategory
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 카드 그리드 */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <BookOpen size={48} className="mb-4 text-gray-300" />
          <p className="text-lg mb-1">저장된 장표가 없습니다.</p>
          <p className="text-sm">새 장표를 만들어 보관함에 저장하세요.</p>
          <button
            onClick={() => navigate('/editor')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Plus size={16} />
            새 장표 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* 미리보기 영역 (클릭 시 편집기로 이동) */}
              <div
                onClick={() => navigate(`/editor?libraryId=${item.id}`)}
                className="h-40 bg-gray-50 border-b border-gray-200 relative overflow-hidden cursor-pointer"
              >
                <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                  <BookOpen size={32} />
                </div>
                {/* 호버 시 오버레이 */}
                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-3 py-1 rounded-lg">
                    편집하기
                  </span>
                </div>
              </div>

              {/* 정보 영역 */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                    {item.name}
                  </h3>
                </div>

                {item.category && (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full mb-2 ${getCategoryColor(item.category)}`}
                  >
                    {item.category}
                  </span>
                )}

                {item.description && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                    {item.description}
                  </p>
                )}

                <p className="text-xs text-gray-400 mb-3">
                  {formatDate(item.created_at)}
                </p>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/editor?libraryId=${item.id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Pencil size={12} />
                    편집
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="장표 삭제"
        message={`"${deleteTarget?.name}" 장표를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
      />
    </div>
  );
}
