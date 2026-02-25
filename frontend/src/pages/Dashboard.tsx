import { FileText, Users, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// 대시보드 플레이스홀더 데이터
const statusCards = [
  { label: '작성중', count: 3, icon: FileText, color: 'blue' },
  { label: '검토중', count: 1, icon: Clock, color: 'yellow' },
  { label: '완료', count: 12, icon: CheckCircle, color: 'green' },
];

const recentBids = [
  {
    id: 1,
    name: 'OO부 정보시스템 구축',
    client: 'OO시청',
    deadline: '2026-03-15',
    dDay: 19,
    status: '작성중',
    pageCount: 6,
    personnelCount: 3,
  },
  {
    id: 2,
    name: '△△ 데이터분석 용역',
    client: '△△공단',
    deadline: '2026-03-20',
    dDay: 24,
    status: '검토중',
    pageCount: 8,
    personnelCount: 4,
  },
];

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-500' },
  green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
};

export default function Dashboard() {
  return (
    <div className="max-w-5xl">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {statusCards.map((card) => {
          const colors = colorMap[card.color];
          return (
            <div
              key={card.label}
              className={`${colors.bg} rounded-xl p-5 border border-gray-100`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  {card.label}
                </span>
                <card.icon size={20} className={colors.icon} />
              </div>
              <p className={`text-3xl font-bold ${colors.text}`}>
                {card.count}
              </p>
            </div>
          );
        })}
      </div>

      {/* 진행중인 입찰 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          진행중인 입찰
          <span className="text-sm font-normal text-gray-500 ml-2">
            마감일 가까운 순
          </span>
        </h2>

        <div className="space-y-3">
          {recentBids.map((bid) => (
            <div
              key={bid.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800">{bid.name}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bid.status === '작성중'
                          ? 'bg-blue-100 text-blue-700'
                          : bid.status === '검토중'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {bid.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>발주처: {bid.client}</span>
                    <span className="text-gray-300">|</span>
                    <span>
                      마감: {bid.deadline} (D-{bid.dDay})
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText size={14} /> 장표 {bid.pageCount}개
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} /> 인력 {bid.personnelCount}명
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
          ))}
        </div>
      </div>

      {/* 새 입찰 버튼 */}
      <Link
        to="/bids"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        + 새 입찰 만들기
      </Link>
    </div>
  );
}
