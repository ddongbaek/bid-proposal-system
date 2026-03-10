/**
 * HWP 변환 전역 스토어
 *
 * 페이지 이동해도 변환이 계속되고 결과가 유지됨.
 * 모듈 레벨 싱글턴 + 구독 패턴으로 React 컴포넌트와 연동.
 */

import { hwpApi } from './api';

export interface HwpSection {
  index: number;
  label: string;
}

export interface HwpConversionState {
  status: 'idle' | 'converting' | 'done' | 'error';
  fileName: string | null;
  file: File | null;
  htmlContent: string | null;
  sections: HwpSection[];
  error: string | null;
}

type Listener = () => void;

// 모듈 레벨 싱글턴 상태
let state: HwpConversionState = {
  status: 'idle',
  fileName: null,
  file: null,
  htmlContent: null,
  sections: [],
  error: null,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function setState(partial: Partial<HwpConversionState>) {
  state = { ...state, ...partial };
  notify();
}

/** 현재 상태 읽기 */
export function getHwpConversionState(): HwpConversionState {
  return state;
}

/** 상태 변경 구독 (React useSyncExternalStore용) */
export function subscribeHwpConversion(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** HWP 파일 변환 시작 (페이지 이동해도 계속됨) */
export function startHwpConversion(file: File) {
  setState({
    status: 'converting',
    fileName: file.name,
    file,
    htmlContent: null,
    sections: [],
    error: null,
  });

  hwpApi
    .toHtml(file)
    .then((result) => {
      setState({
        status: 'done',
        htmlContent: result.html_content,
        sections: result.sections ?? [],
      });
    })
    .catch((err) => {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'HTML 변환에 실패했습니다.';
      setState({ status: 'error', error: msg });
    });
}

/** 상태 초기화 */
export function resetHwpConversion() {
  setState({
    status: 'idle',
    fileName: null,
    file: null,
    htmlContent: null,
    sections: [],
    error: null,
  });
}
