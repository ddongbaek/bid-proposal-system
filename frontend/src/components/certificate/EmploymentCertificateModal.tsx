import { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { generateCertificateHTML } from './certificateTemplate';
import { COMPANY_SEAL_BASE64, KOIS_LOGO_BASE64 } from './assets';
import type { PersonnelCreate } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  personnel: PersonnelCreate;
}

const STORAGE_KEY = 'cert_seq_number';

function getNextSeqNumber(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return parseInt(stored, 10) + 1;
  return 60; // 기본값 59 다음 번호
}

function saveSeqNumber(seq: number): void {
  localStorage.setItem(STORAGE_KEY, String(seq));
}

function maskResidentNumber(rn: string | undefined | null): string {
  if (!rn) return '';
  const cleaned = rn.replace(/\s/g, '');
  if (cleaned.length >= 8 && cleaned.includes('-')) {
    const [front, back] = cleaned.split('-');
    if (back && back.length > 0) {
      return `${front}-${back[0]}${'*'.repeat(back.length - 1)}`;
    }
    return cleaned;
  }
  if (cleaned.length === 13) {
    return `${cleaned.slice(0, 6)}-${cleaned[6]}${'*'.repeat(6)}`;
  }
  return cleaned;
}

function formatHireDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}부터 현재까지`;
}

function formatCertDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년  ${d.getMonth() + 1}월  ${d.getDate()}일`;
}

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EmploymentCertificateModal({ isOpen, onClose, personnel }: Props) {
  const currentYear = new Date().getFullYear();
  const [seqNumber, setSeqNumber] = useState(60);
  const [certNumberText, setCertNumberText] = useState('');
  const [purpose, setPurpose] = useState('공공기관 제출');
  const [certDate, setCertDate] = useState(getTodayString());

  // 모달 열릴 때마다 다음 번호 계산
  useEffect(() => {
    if (isOpen) {
      const next = getNextSeqNumber();
      setSeqNumber(next);
      setCertNumberText(`제 ${currentYear}-${next}호`);
      setCertDate(getTodayString());
    }
  }, [isOpen, currentYear]);

  if (!isOpen) return null;

  const handleSeqChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setSeqNumber(num);
      setCertNumberText(`제 ${currentYear}-${num}호`);
    }
  };

  const handlePrint = () => {
    // 현재 번호를 localStorage에 저장 (다음에 +1)
    saveSeqNumber(seqNumber);

    const html = generateCertificateHTML({
      certNumber: certNumberText,
      name: personnel.name || '',
      residentNumber: maskResidentNumber(personnel.resident_number),
      title: personnel.title || '',
      hireDateFormatted: formatHireDate(personnel.hire_date),
      purpose,
      dateFormatted: formatCertDate(certDate),
      sealImageBase64: COMPANY_SEAL_BASE64,
      logoImageBase64: KOIS_LOGO_BASE64,
    });
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const ic = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-800">재직증명서 출력</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">증명서 번호</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 flex-shrink-0">제 {currentYear}-</span>
              <input
                type="number"
                value={seqNumber}
                onChange={(e) => handleSeqChange(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
              />
              <span className="text-sm text-gray-500 flex-shrink-0">호</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">발급 시 자동으로 다음 번호가 저장됩니다</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">용도</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className={ic}
              placeholder="공공기관 제출"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발급일</label>
            <input
              type="date"
              value={certDate}
              onChange={(e) => setCertDate(e.target.value)}
              className={ic}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
            <p><span className="font-medium">성명:</span> {personnel.name || '-'}</p>
            <p><span className="font-medium">주민등록번호:</span> {maskResidentNumber(personnel.resident_number) || '-'}</p>
            <p><span className="font-medium">직위:</span> {personnel.title || '-'}</p>
            <p><span className="font-medium">재직기간:</span> {formatHireDate(personnel.hire_date) || '-'}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            <Printer size={16} /> 미리보기 & 인쇄
          </button>
        </div>
      </div>
    </div>
  );
}
