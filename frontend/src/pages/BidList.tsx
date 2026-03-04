import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Clock, CheckCircle, Calendar, Building2, Hash, Trash2 } from 'lucide-react';
import SearchBar from '../components/common/SearchBar';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { bidApi } from '../services/api';
import type { Bid, BidStatus, BidCreate } from '../types';

const mockBids: Bid[] = [
  { id: 1, bid_name: 'OO부 정보시스템 구축', client_name: 'OO시청', bid_number: '2026-001', deadline: '2026-03-15', status: 'draft', page_count: 6, personnel_count: 3, created_at: '2026-02-24T10:00:00' },
  { id: 2, bid_name: '데이터분석 용역', client_name: '공단', bid_number: '2026-002', deadline: '2026-03-20', status: 'review', page_count: 8, personnel_count: 4, created_at: '2026-02-24T11:00:00' },
  { id: 3, bid_name: '클라우드 전환 사업', client_name: '교육청', bid_number: '2025-045', deadline: '2025-12-31', status: 'complete', page_count: 10, personnel_count: 5, created_at: '2025-11-01T09:00:00' },
];

const statusConfig: Record<BidStatus, { label: string; icon: typeof FileText; bg: string; text: string }> = {
  draft: { label: '작성중', icon: FileText, bg: 'bg-blue-100', text: 'text-blue-700' },
  review: { label: '검토중', icon: Clock, bg: 'bg-yellow-100', text: 'text-yellow-700' },
  complete: { label: '완료', icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-700' },
};

const statusOptions: { value: string; label: string }[] = [
  { value: '전체', label: '전체' },
  { value: 'draft', label: '작성중' },
  { value: 'review', label: '검토중' },
  { value: 'complete', label: '완료' },
];

function getDDay(deadline: string | null): string | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
}

export default function BidList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Bid[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bid | null>(null);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size: pageSize };
      if (search) params.search = search;
      if (statusFilter !== '전체') params.status = statusFilter;
      const response = await bidApi.list(params as Parameters<typeof bidApi.list>[0]);
      setItems(response.items);
      setTotal(response.total);
    } catch {
      // API 미연결 시 mock 데이터 fallback
      let filtered = [...mockBids];
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (b) => b.bid_name.toLowerCase().includes(q) || (b.client_name && b.client_name.toLowerCase().includes(q))
        );
      }
      if (statusFilter !== '전체') {
        filtered = filtered.filter((b) => b.status === statusFilter);
      }
      setItems(filtered);
      setTotal(filtered.length);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalPages = Math.ceil(total / pageSize);

  const handleCreateBid = async (data: BidCreate) => {
    try {
      const created = await bidApi.create(data);
      setShowCreateModal(false);
      navigate(`/bids/${created.id}/workspace`);
    } catch {
      // fallback: 모달 닫고 목록 새로고침
      setShowCreateModal(false);
      fetchData();
    }
  };

  const handleDelete = async (bid: Bid) => {
    try {
      await bidApi.delete(bid.id);
      setDeleteTarget(null);
      fetchData();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">입찰 관리</h2>
          <p className="text-sm text-gray-500 mt-1">등록된 입찰 {total}건</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          새 입찰
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 max-w-sm">
          <SearchBar value={search} onChange={setSearch} placeholder="입찰명, 발주처로 검색..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>상태: {opt.label}</option>
          ))}
        </select>
      </div>

      {/* 입찰 카드 목록 */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          {search || statusFilter !== '전체' ? '검색 결과가 없습니다.' : '등록된 입찰이 없습니다.'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((bid) => {
            const sc = statusConfig[bid.status];
            const dDay = getDDay(bid.deadline);
            return (
              <div
                key={bid.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/bids/${bid.id}/workspace`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-800">{bid.bid_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {bid.client_name && (
                        <>
                          <span className="flex items-center gap-1"><Building2 size={14} />{bid.client_name}</span>
                          <span className="text-gray-300">|</span>
                        </>
                      )}
                      {bid.bid_number && (
                        <>
                          <span className="flex items-center gap-1"><Hash size={14} />{bid.bid_number}</span>
                          <span className="text-gray-300">|</span>
                        </>
                      )}
                      {bid.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          마감: {bid.deadline}
                          {dDay && (
                            <span className={`ml-1 text-xs font-medium ${dDay.startsWith('D+') ? 'text-red-500' : dDay === 'D-Day' ? 'text-red-600 font-bold' : 'text-blue-600'}`}>
                              ({dDay})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>장표 {bid.page_count}개</span>
                      <span>인력 {bid.personnel_count}명</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/bids/${bid.id}/workspace`); }}
                      className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      작업하기
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(bid); }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="입찰 삭제"
        message={`"${deleteTarget?.bid_name}" 입찰을 삭제하시겠습니까? 포함된 장표와 파일이 모두 삭제됩니다.`}
        confirmLabel="삭제"
        variant="danger"
      />

      {/* 입찰 생성 모달 */}
      <CreateBidModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateBid}
      />
    </div>
  );
}

// ===== 입찰 생성 모달 =====

interface CreateBidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BidCreate) => void;
}

function CreateBidModal({ isOpen, onClose, onSubmit }: CreateBidModalProps) {
  const [bidName, setBidName] = useState('');
  const [clientName, setClientName] = useState('');
  const [bidNumber, setBidNumber] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        bid_name: bidName.trim(),
        client_name: clientName.trim() || null,
        bid_number: bidNumber.trim() || null,
        deadline: deadline || null,
        requirements_text: requirementsText.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setBidName('');
      setClientName('');
      setBidNumber('');
      setDeadline('');
      setRequirementsText('');
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="새 입찰 만들기" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            입찰명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={bidName}
            onChange={(e) => setBidName(e.target.value)}
            placeholder="예: OO부 정보시스템 구축"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발주처</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="예: OO시청"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">공고번호</label>
            <input
              type="text"
              value={bidNumber}
              onChange={(e) => setBidNumber(e.target.value)}
              placeholder="예: 2026-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">마감일</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제출서류 목록 (메모)</label>
          <textarea
            value={requirementsText}
            onChange={(e) => setRequirementsText(e.target.value)}
            placeholder="1. 참여인력 현황표&#10;2. 유사실적 증명서&#10;3. ..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!bidName.trim() || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '생성중...' : '생성'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
