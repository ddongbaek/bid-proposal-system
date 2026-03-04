import { useState, useEffect } from 'react';
import { Building2, Save, Loader2, Phone, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { companyApi } from '../services/api';
import type { CompanyInfo } from '../types';

export default function Settings() {
  const [form, setForm] = useState<Partial<CompanyInfo>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const data = await companyApi.get();
      setForm(data);
    } catch {
      // 첫 로드 실패 시 빈 폼으로 시작
      setForm({});
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CompanyInfo, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || null }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // id, updated_at 등 서버 관리 필드 제외하고 전송
      const { id, updated_at, ...updateData } = form as CompanyInfo;
      const data = await companyApi.update(updateData);
      setForm(data);
      setMessage({ type: 'success', text: '저장되었습니다.' });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : '';
      setMessage({ type: 'error', text: `저장에 실패했습니다. ${detail}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">회사 기본정보</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          저장
        </button>
      </div>

      {/* 저장 결과 메시지 */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* 기본정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 size={20} className="text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">기본정보</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
            <input
              type="text"
              value={form.company_name || ''}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="주식회사 KOIS"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록번호</label>
            <input
              type="text"
              value={form.business_number || ''}
              onChange={(e) => handleChange('business_number', e.target.value)}
              placeholder="123-45-67890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">법인등록번호</label>
            <input
              type="text"
              value={form.corporate_number || ''}
              onChange={(e) => handleChange('corporate_number', e.target.value)}
              placeholder="110111-1234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대표자</label>
            <input
              type="text"
              value={form.representative || ''}
              onChange={(e) => handleChange('representative', e.target.value)}
              placeholder="홍길동"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대표자 생년월일</label>
            <input
              type="date"
              value={form.representative_birth || ''}
              onChange={(e) => handleChange('representative_birth', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 연락처 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Phone size={20} className="text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">연락처</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="서울특별시 강남구 ..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">전화</label>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="02-1234-5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">팩스</label>
            <input
              type="text"
              value={form.fax || ''}
              onChange={(e) => handleChange('fax', e.target.value)}
              placeholder="02-1234-5679"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="info@company.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">홈페이지</label>
            <input
              type="text"
              value={form.website || ''}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://www.company.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 사업정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Briefcase size={20} className="text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">사업정보</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">업종</label>
            <input
              type="text"
              value={form.business_type || ''}
              onChange={(e) => handleChange('business_type', e.target.value)}
              placeholder="소프트웨어 개발"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">업태</label>
            <input
              type="text"
              value={form.business_category || ''}
              onChange={(e) => handleChange('business_category', e.target.value)}
              placeholder="서비스업"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설립일</label>
            <input
              type="date"
              value={form.establishment_date || ''}
              onChange={(e) => handleChange('establishment_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">자본금</label>
            <input
              type="text"
              value={form.capital || ''}
              onChange={(e) => handleChange('capital', e.target.value)}
              placeholder="1억원"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상시근로자수</label>
            <input
              type="text"
              value={form.employee_count || ''}
              onChange={(e) => handleChange('employee_count', e.target.value)}
              placeholder="50명"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
