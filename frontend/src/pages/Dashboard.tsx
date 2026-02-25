import { useState, useEffect } from 'react';
import { FileText, Users, CheckCircle, Clock, ArrowRight, Loader2, Plus, Edit3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bidApi, personnelApi } from '../services/api';
import type { Bid, BidStatus } from '../types';

const statusConfig: Record<BidStatus, { label: string; bg: string; text: string; icon: string; badgeBg: string; badgeText: string }> = {
  draft: { label: '작성중', bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
  review: { label: '검토중', bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-500', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-700' },
  complete: { label: '완료', bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500', badgeBg: 'bg-green-100', badgeText: 'text-green-700' },
};

const statusIcons: Record<BidStatus, typeof FileText> = {
  draft: Edit3,
  review: Clock,
  complete: CheckCircle,
};

function getDDay(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [totalPersonnel, setTotalPersonnel] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [bidResult, personnelResult] = await Promise.all([
          bidApi.list({ size: 100 }),
          personnelApi.list({ size: 1 }),
        ]);
        setBids(bidResult.items);
        setTotalPersonnel(personnelResult.total);
      } catch {
        // API 미연결 시 빈 상태
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 상태별 카운트
  const statusCounts: Record<BidStatus, number> = { draft: 0, review: 0, complete: 0 };
  bids.forEach((b) => {
    if (statusCounts[b.status] !== undefined) statusCounts[b.status]++;
  });

  // 진행중 입찰 (draft/review), 마감일 가까운 순
  const activeBids = bids
    .filter((b) => b.status !== 'complete')
    .sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {(['draft', 'review', 'complete'] as BidStatus[]).map((status) => {
          const config = statusConfig[status];
          const Icon = statusIcons[status];
          return (
            <div key={status} className={`${config.bg} rounded-xl p-5 border border-gray-100`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">{config.label}</span>
                <Icon size={20} className={config.icon} />
              </div>
              <p className={`text-3xl font-bold ${config.text}`}>{statusCounts[status]}</p>
            </div>
          );
        })}
        <div className="bg-purple-50 rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">등록 인력</span>
            <Users size={20} className="text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-purple-700">{totalPersonnel}</p>
        </div>
      </div>

      {/* 진행중인 입찰 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          진행중인 입찰
          <span className="text-sm font-normal text-gray-500 ml-2">
            {activeBids.length > 0 ? '마감일 가까운 순' : ''}
          </span>
        </h2>

        {activeBids.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            <FileText size={40} className="mx-auto mb-3" />
            <p className="font-medium">진행중인 입찰이 없습니다</p>
            <p className="text-sm mt-1">새 입찰을 만들어보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeBids.map((bid) => {
              const config = statusConfig[bid.status];
              const dDay = getDDay(bid.deadline);
              return (
                <div
                  key={bid.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800">{bid.bid_name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.badgeBg} ${config.badgeText}`}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {bid.client_name && <span>발주처: {bid.client_name}</span>}
                        {bid.client_name && bid.deadline && <span className="text-gray-300">|</span>}
                        {bid.deadline && (
                          <span>
                            마감: {bid.deadline}
                            {dDay !== null && (
                              <span className={`ml-1 font-medium ${dDay <= 3 ? 'text-red-500' : dDay <= 7 ? 'text-orange-500' : 'text-gray-500'}`}>
                                (D{dDay <= 0 ? dDay : `-${dDay}`})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText size={14} /> 장표 {bid.page_count}개
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={14} /> 인력 {bid.personnel_count}명
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/bids/${bid.id}/workspace`}
                      className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      작업하기
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3">
        <Link
          to="/bids"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          새 입찰 만들기
        </Link>
        <Link
          to="/personnel"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Users size={16} />
          인력 관리
        </Link>
      </div>
    </div>
  );
}
