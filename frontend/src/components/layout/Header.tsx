import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': '대시보드',
  '/personnel': '인력관리',
  '/bids': '입찰관리',
  '/library': '장표보관',
  '/settings': '설정',
};

export default function Header() {
  const location = useLocation();

  // 현재 경로에 맞는 페이지 제목 찾기
  const getPageTitle = () => {
    // 정확한 매칭 먼저 시도
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname];
    }
    // 접두사 매칭
    if (location.pathname.startsWith('/personnel/')) {
      return '인력관리';
    }
    if (location.pathname.startsWith('/bids/')) {
      return '입찰관리';
    }
    return '정량제안서 관리 시스템';
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-800">
          {getPageTitle()}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">정량제안서 관리 시스템</span>
      </div>
    </header>
  );
}
