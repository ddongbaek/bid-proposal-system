import axios from 'axios';
import type {
  Personnel,
  PersonnelCreate,
  PersonnelListResponse,
  Certification,
  ProjectHistory,
  ProjectHistoryCreate,
} from '../types';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
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
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
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

export default api;
