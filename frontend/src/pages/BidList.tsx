import { FileText, Clock, CheckCircle, Plus } from 'lucide-react';

const mockBids = [
  { id: 1, name: 'OO부 정보시스템 구축', client: 'OO시청', bidNumber: '2026-001', deadline: '2026-03-15', status: 'draft' as const, pageCount: 6, personnelCount: 3 },
  { id: 2, name: '데이터분석 용역', client: '공단', bidNumber: '2026-002', deadline: '2026-03-20', status: 'review' as const, pageCount: 8, personnelCount: 4 },
  { id: 3, name: '클라우드 전환 사업', client: '교육청', bidNumber: '2025-045', deadline: '2025-12-31', status: 'complete' as const, pageCount: 10, personnelCount: 5 },
];

const statusConfig = {
  draft: { label: '작성중', icon: FileText, bg: 'bg-blue-100', text: 'text-blue-700' },
  review: { label: '검토중', icon: Clock, bg: 'bg-yellow-100', text: 'text-yellow-700' },
  complete: { label: '완료', icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-700' },
};

export default function BidList() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">입찰 관리</h2>
          <p className="text-sm text-gray-500 mt-1">등록된 입찰 {mockBids.length}건</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} /> 새 입찰
        </button>
      </div>

      <div className="space-y-3">
        {mockBids.map((bid) => {
          const sc = statusConfig[bid.status];
          return (
            <div key={bid.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800">{bid.name}</h3>
                    <span className={'px-2.5 py-0.5 rounded-full text-xs font-medium ' + sc.bg + ' ' + sc.text}>{sc.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{bid.client}</span>
                    <span className="text-gray-300">|</span>
                    <span>{bid.bidNumber}</span>
                    <span className="text-gray-300">|</span>
                    <span>마감: {bid.deadline}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>장표 {bid.pageCount}개</span>
                    <span>인력 {bid.personnelCount}명</span>
                  </div>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                  작업하기
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
        <p className="text-gray-400 text-sm">입찰 관리 기능은 Phase 2에서 구현됩니다.</p>
      </div>
    </div>
  );
}
