// ===== 인력 관련 타입 =====

export interface Personnel {
  id: number;
  name: string;
  title: string | null;
  department: string | null;
  birth_date: string | null;
  resident_number: string | null;
  phone: string | null;
  email: string | null;
  education_level: string | null;
  education_school: string | null;
  education_major: string | null;
  graduation_year: number | null;
  hire_date: string | null;
  years_of_experience: number | null;
  notes: string | null;
  certifications?: Certification[];
  project_history?: ProjectHistory[];
  created_at: string;
  updated_at: string;
}

export interface PersonnelCreate {
  name: string;
  title?: string | null;
  department?: string | null;
  birth_date?: string | null;
  resident_number?: string | null;
  phone?: string | null;
  email?: string | null;
  education_level?: string | null;
  education_school?: string | null;
  education_major?: string | null;
  graduation_year?: number | null;
  hire_date?: string | null;
  years_of_experience?: number | null;
  notes?: string | null;
}

export interface PersonnelSummary {
  id: number;
  name: string;
  title: string | null;
  department: string | null;
  years_of_experience: number | null;
  certification_count: number;
  project_count: number;
}

export interface PersonnelListResponse {
  items: PersonnelSummary[];
  total: number;
  page: number;
  size: number;
}

// ===== 자격증 관련 타입 =====

export interface Certification {
  id: number;
  cert_name: string;
  cert_number: string | null;
  cert_date: string | null;
  cert_issuer: string | null;
  cert_file_path: string | null;
  has_file: boolean;
}

export interface CertificationCreate {
  cert_name: string;
  cert_number?: string;
  cert_date?: string | null;
  cert_issuer?: string;
  file?: File | null;
}

// ===== 프로젝트 이력 관련 타입 =====

export interface ProjectHistory {
  id: number;
  project_name: string;
  client: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  description: string | null;
}

export interface ProjectHistoryCreate {
  project_name: string;
  client?: string | null;
  role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: string | null;
  description?: string | null;
}

// ===== 입찰 관련 타입 =====

export interface Bid {
  id: number;
  bid_name: string;
  client_name: string;
  bid_number: string;
  deadline: string | null;
  status: 'draft' | 'review' | 'complete';
  page_count: number;
  personnel_count: number;
  created_at: string;
}

export interface BidListResponse {
  items: Bid[];
  total: number;
  page: number;
  size: number;
}

// ===== 장표 라이브러리 관련 타입 =====

export interface PageLibraryItem {
  id: number;
  name: string;
  category: string | null;
  html_content: string;
  css_content: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageLibrarySummary {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

export interface PageLibraryCreate {
  name: string;
  category?: string;
  html_content: string;
  css_content?: string;
  description?: string;
}

// ===== AI 관련 타입 =====

export interface AiPdfToHtmlResponse {
  html_content: string;
  css_content: string | null;
  detected_variables: string[];
  message: string;
}

export interface AiModifyRequest {
  html_content: string;
  css_content?: string;
  request: string;
}

export interface AiModifyResponse {
  html_content: string;
  css_content: string | null;
  changes_description: string;
}

// AI 채팅 메시지
export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ===== 공통 타입 =====

export interface ApiError {
  detail: string;
}

export interface PaginationParams {
  page: number;
  size: number;
}
