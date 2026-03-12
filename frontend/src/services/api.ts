import axios from 'axios';
import type {
  Personnel,
  PersonnelCreate,
  PersonnelListResponse,
  Certification,
  ProjectHistory,
  ProjectHistoryCreate,
  AiPdfToHtmlResponse,
  AiModifyRequest,
  AiModifyResponse,
  PageLibrarySummary,
  PageLibraryItem,
  PageLibraryCreate,
  BidCreate,
  BidUpdate,
  BidDetail,
  BidListResponse,
  BidPage,
  BidPageCreateHtml,
  BidPageUpdate,
  BidPersonnel,
  BidPersonnelCreate,
  BidStatus,
  CompanyInfo,
} from '../types';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 응답 인터셉터: 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error: 서버에 연결할 수 없습니다.');
    }
    return Promise.reject(error);
  }
);

// ===== 인력 관리 API =====

export const personnelApi = {
  /** 인력 목록 조회 */
  list: async (params?: {
    search?: string;
    department?: string;
    page?: number;
    size?: number;
  }): Promise<PersonnelListResponse> => {
    const response = await api.get('/personnel', { params });
    return response.data;
  },

  /** 인력 상세 조회 */
  getById: async (id: number): Promise<Personnel> => {
    const response = await api.get(`/personnel/${id}`);
    return response.data;
  },

  /** 인력 등록 */
  create: async (data: PersonnelCreate): Promise<Personnel> => {
    const response = await api.post('/personnel', data);
    return response.data;
  },

  /** 인력 수정 */
  update: async (id: number, data: Partial<PersonnelCreate>): Promise<Personnel> => {
    const response = await api.put(`/personnel/${id}`, data);
    return response.data;
  },

  /** 인력 삭제 */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/personnel/${id}`);
  },
};

// ===== 자격증 API =====

export const certificationApi = {
  /** 자격증 목록 조회 */
  list: async (personnelId: number): Promise<Certification[]> => {
    const response = await api.get(`/personnel/${personnelId}/certifications`);
    return response.data;
  },

  /** 자격증 추가 (파일 업로드 포함) */
  create: async (personnelId: number, data: FormData): Promise<Certification> => {
    const response = await api.post(
      `/personnel/${personnelId}/certifications`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  /** 자격증 삭제 */
  delete: async (personnelId: number, certId: number): Promise<void> => {
    await api.delete(`/personnel/${personnelId}/certifications/${certId}`);
  },

  /** 자격증 파일 다운로드 URL */
  getFileUrl: (personnelId: number, certId: number): string => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
    return `${baseURL}/personnel/${personnelId}/certifications/${certId}/file`;
  },
};

// ===== 프로젝트 이력 API =====

export const projectHistoryApi = {
  /** 이력 목록 조회 */
  list: async (personnelId: number): Promise<ProjectHistory[]> => {
    const response = await api.get(`/personnel/${personnelId}/projects`);
    return response.data;
  },

  /** 이력 추가 */
  create: async (personnelId: number, data: ProjectHistoryCreate): Promise<ProjectHistory> => {
    const response = await api.post(`/personnel/${personnelId}/projects`, data);
    return response.data;
  },

  /** 이력 수정 */
  update: async (
    personnelId: number,
    projectId: number,
    data: Partial<ProjectHistoryCreate>
  ): Promise<ProjectHistory> => {
    const response = await api.put(
      `/personnel/${personnelId}/projects/${projectId}`,
      data
    );
    return response.data;
  },

  /** 이력 삭제 */
  delete: async (personnelId: number, projectId: number): Promise<void> => {
    await api.delete(`/personnel/${personnelId}/projects/${projectId}`);
  },
};

// ===== AI API =====

export const aiApi = {
  /** PDF를 HTML로 변환 (Gemini AI) */
  pdfToHtml: async (file: File, instructions?: string): Promise<AiPdfToHtmlResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (instructions) formData.append('instructions', instructions);
    const response = await api.post('/ai/pdf-to-html', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // AI 변환은 시간이 걸림
    });
    return response.data;
  },

  /** AI로 HTML 자연어 수정 */
  modify: async (data: AiModifyRequest): Promise<AiModifyResponse> => {
    const response = await api.post('/ai/modify', data, {
      timeout: 60000,
    });
    return response.data;
  },
};

// ===== 장표 라이브러리 API =====

export const libraryApi = {
  /** 라이브러리 목록 조회 */
  list: async (category?: string): Promise<PageLibrarySummary[]> => {
    const response = await api.get('/library/', { params: category ? { category } : {} });
    return response.data;
  },

  /** 라이브러리 항목 상세 조회 */
  getById: async (id: number): Promise<PageLibraryItem> => {
    const response = await api.get(`/library/${id}`);
    return response.data;
  },

  /** 장표를 라이브러리에 저장 */
  create: async (data: PageLibraryCreate): Promise<PageLibraryItem> => {
    const response = await api.post('/library/', data);
    return response.data;
  },

  /** 라이브러리 항목 삭제 */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/library/${id}`);
  },
};

// ===== 입찰 관리 API =====

export const bidApi = {
  /** 입찰 목록 조회 */
  list: async (params?: {
    status?: BidStatus;
    search?: string;
    page?: number;
    size?: number;
  }): Promise<BidListResponse> => {
    const response = await api.get('/bids/', { params });
    return response.data;
  },

  /** 입찰 상세 조회 */
  getById: async (id: number): Promise<BidDetail> => {
    const response = await api.get(`/bids/${id}`);
    return response.data;
  },

  /** 입찰 생성 */
  create: async (data: BidCreate): Promise<BidDetail> => {
    const response = await api.post('/bids/', data);
    return response.data;
  },

  /** 입찰 수정 */
  update: async (id: number, data: BidUpdate): Promise<BidDetail> => {
    const response = await api.put(`/bids/${id}`, data);
    return response.data;
  },

  /** 입찰 삭제 */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/bids/${id}`);
  },

  // --- 장표 관리 ---

  /** HTML 장표 추가 */
  addPageHtml: async (bidId: number, data: BidPageCreateHtml): Promise<BidPage> => {
    const response = await api.post(`/bids/${bidId}/pages/html`, data);
    return response.data;
  },

  /** PDF 장표 업로드 */
  addPagePdf: async (bidId: number, file: File, pageName?: string): Promise<BidPage> => {
    const formData = new FormData();
    formData.append('file', file);
    if (pageName) formData.append('page_name', pageName);
    const response = await api.post(`/bids/${bidId}/pages/pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** 장표 상세 조회 */
  getPage: async (bidId: number, pageId: number): Promise<BidPage> => {
    const response = await api.get(`/bids/${bidId}/pages/${pageId}`);
    return response.data;
  },

  /** 장표 수정 */
  updatePage: async (bidId: number, pageId: number, data: BidPageUpdate): Promise<BidPage> => {
    const response = await api.put(`/bids/${bidId}/pages/${pageId}`, data);
    return response.data;
  },

  /** 장표 삭제 */
  deletePage: async (bidId: number, pageId: number): Promise<void> => {
    await api.delete(`/bids/${bidId}/pages/${pageId}`);
  },

  /** 장표 순서 변경 */
  reorderPages: async (bidId: number, pageIds: number[]): Promise<void> => {
    await api.put(`/bids/${bidId}/pages/reorder`, { page_ids: pageIds });
  },

  // --- 인력 배정 ---

  /** 인력 배정 */
  addPersonnel: async (bidId: number, data: BidPersonnelCreate): Promise<BidPersonnel> => {
    const response = await api.post(`/bids/${bidId}/personnel`, data);
    return response.data;
  },

  /** 인력 배정 해제 */
  removePersonnel: async (bidId: number, assignmentId: number): Promise<void> => {
    await api.delete(`/bids/${bidId}/personnel/${assignmentId}`);
  },

  /** 장표에 인력 데이터 자동 채움 */
  fillPersonnel: async (bidId: number, pageId: number, personnelId: number, save: boolean = false): Promise<{
    html_content: string;
    filled_count: number;
    remaining: string[];
  }> => {
    const response = await api.post(`/bids/${bidId}/pages/${pageId}/fill`, {
      personnel_id: personnelId,
      save,
    });
    return response.data;
  },

  /** 전체 인력 한번에 채우기 (다수 인력 테이블용) */
  fillAllPersonnel: async (bidId: number, pageId: number, save: boolean = false): Promise<{
    html_content: string;
    filled_count: number;
    remaining: string[];
  }> => {
    const response = await api.post(`/bids/${bidId}/pages/${pageId}/fill-all?save=${save}`);
    return response.data;
  },
};

// ===== PDF 생성/병합 API =====

export const pdfApi = {
  /** 개별 장표 PDF 생성 (HTML→PDF, PDF 바이트 반환) */
  generate: async (pageId: number): Promise<Blob> => {
    const response = await api.post(`/pdf/generate/${pageId}`, null, {
      responseType: 'blob',
      timeout: 120000,
    });
    return response.data;
  },

  /** 최종 PDF 병합 (모든 장표 변환+병합, PDF 바이트 반환) */
  merge: async (bidId: number): Promise<Blob> => {
    const response = await api.post(`/pdf/merge/${bidId}`, null, {
      responseType: 'blob',
      timeout: 120000,
    });
    return response.data;
  },

  /** PDF 다운로드 URL (이미 생성된 파일 또는 즉시 생성) */
  getDownloadUrl: (bidId: number): string => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
    return `${baseURL}/pdf/download/${bidId}`;
  },
};

// ===== HWP 변환 API =====

export const hwpApi = {
  /** HWP→PDF 변환 (페이지 범위 선택 가능) */
  convert: async (file: File, startPage?: number, endPage?: number): Promise<Blob> => {
    const formData = new FormData();
    formData.append('file', file);
    if (startPage) formData.append('start_page', String(startPage));
    if (endPage) formData.append('end_page', String(endPage));
    const response = await api.post('/hwp/convert', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
      timeout: 120000,
    });
    return response.data;
  },

  /** HWP→HTML 변환 */
  toHtml: async (file: File): Promise<{
    filename: string;
    html_content: string;
    sections: { index: number; label: string }[];
    message: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/hwp/to-html', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  /** HWP 섹션 추출 */
  extractSections: async (file: File, sectionIndices: number[]): Promise<{
    filename: string;
    html_content: string;
    selected_sections: number[];
    message: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sections', sectionIndices.join(','));
    const response = await api.post('/hwp/extract-sections', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  /** HWP 파일 정보 (페이지 수 등) */
  info: async (file: File): Promise<{ filename: string; total_pages: number; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/hwp/info', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  /** HWP → PDF 변환 → 워크스페이스 장표로 추가 (치환 or 바로변환) */
  fillToPages: async (file: File, bidId: number, personnelId?: number, mode: 'fill' | 'direct' = 'fill'): Promise<{
    pages: { id: number; page_name: string; page_number: number; sort_order: number }[];
    total_pages: number;
    filled_count: number;
    replacements: Record<string, string>;
    message: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bid_id', String(bidId));
    formData.append('mode', mode);
    if (personnelId && mode === 'fill') formData.append('personnel_id', String(personnelId));
    const response = await api.post('/hwp/fill-to-pages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    });
    return response.data;
  },

  /** HWP→페이지 분리 (HWP→HTML→PDF→개별 페이지로 입찰에 추가) */
  toPages: async (file: File, bidId: number): Promise<{
    pages: { id: number; page_name: string; page_number: number; sort_order: number }[];
    total_pages: number;
    message: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bid_id', String(bidId));
    const response = await api.post('/hwp/to-pages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000, // HWP→HTML→PDF 변환에 시간 소요
    });
    return response.data;
  },

  /** HWP → COM PDF → Gemini AI → HTML 장표 변환 */
  toHtmlPages: async (file: File, bidId: number): Promise<{
    pages: { id: number; page_name: string; page_number: number; sort_order: number; detected_variables?: string[]; fallback_pdf?: boolean }[];
    total_pages: number;
    html_count: number;
    pdf_fallback_count: number;
    failed_pages: { page_number: number; error: string }[];
    message: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bid_id', String(bidId));
    const response = await api.post('/hwp/hwp-to-html-pages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // AI 변환은 페이지당 시간 소요
    });
    return response.data;
  },

  /** PDF 장표 1개를 AI HTML로 변환 (편집+자동채움 가능하게) */
  convertPageToHtml: async (pageId: number): Promise<{
    page_id: number;
    page_type: string;
    detected_variables: string[];
    message: string;
  }> => {
    const response = await api.post(`/hwp/convert-page-to-html/${pageId}`, null, {
      timeout: 120000,
    });
    return response.data;
  },

  /** PDF 장표 분석 → 필드 감지 + 자동채움 (오버레이 편집용) */
  analyzePage: async (pageId: number): Promise<OverlayAnalysis> => {
    const response = await api.post(`/hwp/analyze-page/${pageId}`, null, {
      timeout: 60000,
    });
    return response.data;
  },

  /** 오버레이 필드 적용 (최종 PDF 생성) */
  applyOverlay: async (pageId: number, fields: OverlayField[]): Promise<{ page_id: number; message: string }> => {
    const response = await api.post(`/hwp/apply-overlay/${pageId}`, fields);
    return response.data;
  },

  /** 오버레이 필드 조회 (재편집용) */
  getOverlayFields: async (pageId: number): Promise<OverlayFieldsResponse> => {
    const response = await api.get(`/hwp/overlay-fields/${pageId}`);
    return response.data;
  },

  /** PDF 페이지 이미지 URL */
  pageImageUrl: (pageId: number, pageNum: number): string =>
    `${api.defaults.baseURL}/hwp/page-image/${pageId}/${pageNum}`,
};

// ===== 회사 기본정보 API =====

export const companyApi = {
  /** 회사 정보 조회 */
  get: async (): Promise<CompanyInfo> => {
    const response = await api.get('/company/');
    return response.data;
  },

  /** 회사 정보 수정 */
  update: async (data: Partial<CompanyInfo>): Promise<CompanyInfo> => {
    const response = await api.put('/company/', data);
    return response.data;
  },

  /** 회사 이미지 업로드 (seal_image | certified_copy_image) */
  uploadImage: async (imageType: string, file: File): Promise<CompanyInfo> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/company/images/${imageType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** 회사 이미지 삭제 */
  deleteImage: async (imageType: string): Promise<CompanyInfo> => {
    const response = await api.delete(`/company/images/${imageType}`);
    return response.data;
  },

  /** 회사 이미지 URL */
  imageUrl: (imageType: string): string => {
    const base = import.meta.env.VITE_API_BASE_URL || '/api';
    return `${base}/company/images/${imageType}`;
  },
};

export default api;
