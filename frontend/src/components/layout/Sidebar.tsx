import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Library,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileOutput,
  Loader2,
} from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { getHwpConversionState, subscribeHwpConversion } from '../../services/hwpConversionStore';

const menuItems = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/personnel', label: '인력관리', icon: Users },
  { path: '/bids', label: '입찰관리', icon: FileText },
  { path: '/hwp', label: 'HWP변환', icon: FileOutput },
  { path: '/library', label: '장표보관', icon: Library },
  { path: '/settings', label: '설정', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const hwpState = useSyncExternalStore(subscribeHwpConversion, getHwpConversionState);
  const hwpConverting = hwpState.status === 'converting';

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0`}
    >
      {/* 로고 영역 */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && (
          <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
            정량제안서
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.path === '/hwp' && hwpConverting ? (
              <Loader2 size={20} className="flex-shrink-0 animate-spin text-blue-500" />
            ) : (
              <item.icon size={20} className="flex-shrink-0" />
            )}
            {!collapsed && (
              <span className="flex items-center gap-1.5">
                {item.label}
                {item.path === '/hwp' && hwpConverting && (
                  <span className="text-[10px] text-blue-500 font-normal">변환중</span>
                )}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 하단 버전 정보 */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">v1.0.0</p>
        </div>
      )}
    </aside>
  );
}
