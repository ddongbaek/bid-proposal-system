import { Shield, Key, Database } from 'lucide-react';

export default function Settings() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-gray-800 mb-6">설정</h2>

      {/* IP 접근 제어 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">IP 접근 제어</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-700">192.168.0.0/24</span>
              <span className="text-xs text-gray-500 ml-3">사내 네트워크</span>
            </div>
            <button className="text-xs text-red-500 hover:text-red-700">삭제</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-700">10.0.0.0/8</span>
              <span className="text-xs text-gray-500 ml-3">VPN 대역</span>
            </div>
            <button className="text-xs text-red-500 hover:text-red-700">삭제</button>
          </div>
        </div>
        <button className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">+ IP 추가</button>
      </div>

      {/* Gemini API */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Key size={20} className="text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">Gemini API</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API 키</label>
            <div className="flex gap-2">
              <input type="password" value="sk-xxxxxxxxxxxxxxxxxxxx" readOnly className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" />
              <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">변경</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">모델</label>
            <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm" defaultValue="gemini-2.0-flash">
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-2.0-pro">gemini-2.0-pro</option>
            </select>
          </div>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database size={20} className="text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">데이터 관리</h3>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">데이터 백업 다운로드</button>
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">데이터 복원 업로드</button>
        </div>
      </div>

      <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
        <p className="text-gray-400 text-sm">설정 기능은 Phase 4에서 구현됩니다.</p>
      </div>
    </div>
  );
}
