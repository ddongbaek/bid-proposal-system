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

export type BidStatus = 'draft' | 'review' | 'complete';

export interface Bid {
  id: number;
  bid_name: string;
  client_name: string | null;
  bid_number: string | null;
  deadline: string | null;
  status: BidStatus;
  page_count: number;
  personnel_count: number;
  created_at: string;
}

export interface BidCreate {
  bid_name: string;
  client_name?: string | null;
  bid_number?: string | null;
  deadline?: string | null;
  requirements_text?: string | null;
}

export interface BidUpdate {
  bid_name?: string | null;
  client_name?: string | null;
  bid_number?: string | null;
  deadline?: string | null;
  status?: BidStatus | null;
  requirements_text?: string | null;
}

export interface BidDetail {
  id: number;
  bid_name: string;
  client_name: string | null;
  bid_number: string | null;
  deadline: string | null;
  status: BidStatus;
  notice_file_path: string | null;
  requirements_text: string | null;
  pages: BidPage[];
  personnel: BidPersonnel[];
  created_at: string;
  updated_at: string;
}

export interface BidListResponse {
  items: Bid[];
  total: number;
  page: number;
  size: number;
}

// ===== 입찰 장표 관련 타입 =====

export type PageType = 'html' | 'pdf';

export interface BidPage {
  id: number;
  bid_id: number;
  page_type: PageType;
  page_name: string | null;
  sort_order: number;
  html_content: string | null;
  css_content: string | null;
  pdf_file_path: string | null;
  pdf_page_start: number | null;
  pdf_page_end: number | null;
  thumbnail_path: string | null;
  generated_pdf_path: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BidPageCreateHtml {
  page_name: string;
  html_content: string;
  css_content?: string | null;
}

export interface BidPageUpdate {
  page_name?: string | null;
  html_content?: string | null;
  css_content?: string | null;
  pdf_page_start?: number | null;
  pdf_page_end?: number | null;
}

// ===== 입찰 인력 배정 관련 타입 =====

export interface BidPersonnel {
  id: number;
  bid_id: number;
  personnel_id: number;
  personnel_name: string | null;
  personnel_title: string | null;
  personnel_department: string | null;
  role_in_bid: string | null;
  sort_order: number | null;
  custom_data: string | null;           // JSON 문자열
  selected_projects: string | null;     // JSON 문자열
  created_at: string | null;
}

export interface BidPersonnelCreate {
  personnel_id: number;
  role_in_bid?: string | null;
  sort_order?: number | null;
  custom_data?: string | null;          // JSON 문자열
  selected_projects?: string | null;    // JSON 문자열 (예: "[1,3,5]")
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

// ===== PDF 오버레이 관련 타입 =====

export interface OverlayField {
  id: string;
  page: number;
  label: string;
  field_key: string;
  rect: [number, number, number, number]; // [x0, y0, x1, y1] PDF pt
  value: string;
  font_size?: number;
}

export interface OverlayPageInfo {
  page: number;
  width: number;
  height: number;
}

export interface OverlayAnalysis {
  page_id: number;
  page_name: string;
  total_pages: number;
  fields: OverlayField[];
  filled_count: number;
  total_fields: number;
  pages_info: OverlayPageInfo[];
  message: string;
}

export interface OverlayFieldsResponse {
  page_id: number;
  fields: OverlayField[];
  pages_info: OverlayPageInfo[];
  total_pages: number;
}

// ===== 공통 타입 =====

export interface ApiError {
  detail: string;
}

export interface PaginationParams {
  page: number;
  size: number;
}

// ===== 회사 기본정보 =====

export interface CompanyInfo {
  id: number;
  company_name: string | null;
  business_number: string | null;
  corporate_number: string | null;
  representative: string | null;
  representative_birth: string | null;
  address: string | null;
  zip_code: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  business_type: string | null;
  business_category: string | null;
  establishment_date: string | null;
  capital: string | null;
  employee_count: string | null;
  seal_image: string | null;
  certified_copy_image: string | null;
  updated_at: string;
}
