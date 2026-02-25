import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Trash2, Plus, Download, X, Pencil, FileText } from 'lucide-react';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmploymentCertificateModal from '../components/certificate/EmploymentCertificateModal';
import { personnelApi, certificationApi, projectHistoryApi } from '../services/api';
import type { Personnel, PersonnelCreate, Certification, CertificationCreate, ProjectHistory, ProjectHistoryCreate } from '../types';

type TabType = 'basic' | 'certifications' | 'projects';

const mockCerts: Certification[] = [
  { id: 1, cert_name: '정보관리기술사', cert_number: '12345', cert_date: '2018-05-20', cert_issuer: '한국산업인력공단', cert_file_path: null, has_file: true },
  { id: 2, cert_name: 'PMP', cert_number: '67890', cert_date: '2020-03-15', cert_issuer: 'PMI', cert_file_path: null, has_file: false },
];

const mockProjs: ProjectHistory[] = [
  { id: 1, project_name: 'OO시 정보화사업', client: 'OO시', role: 'PM', start_date: '2023-03-01', end_date: '2023-12-31', budget: '5억원', description: '시스템 설계 및 프로젝트 총괄' },
  { id: 2, project_name: '시스템 구축', client: '공단', role: 'PL', start_date: '2022-01-01', end_date: '2022-08-31', budget: '3억원', description: '서버 개발 총괄' },
];

const eduLevels = ['고졸', '전문학사', '학사', '석사', '박사'];

export default function PersonnelEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PersonnelCreate>({ name: '', title: '', department: '', birth_date: '', resident_number: '', phone: '', email: '', education_level: '', education_school: '', education_major: '', graduation_year: null, hire_date: '', years_of_experience: 0, notes: '' });
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState<CertificationCreate>({ cert_name: '', cert_number: '', cert_date: '', cert_issuer: '', file: null });
  const [projects, setProjects] = useState<ProjectHistory[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectHistoryCreate>({ project_name: '', client: '', role: '', start_date: '', end_date: '', budget: '', description: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  useEffect(() => { if (!isNew && id) loadData(parseInt(id)); }, [id, isNew]);

  const loadData = async (pid: number) => {
    setLoading(true);
    try {
      const data = await personnelApi.getById(pid);
      setForm({ name: data.name, title: data.title, department: data.department, birth_date: data.birth_date || '', resident_number: data.resident_number || '', phone: data.phone, email: data.email, education_level: data.education_level, education_school: data.education_school, education_major: data.education_major, graduation_year: data.graduation_year, hire_date: data.hire_date || '', years_of_experience: data.years_of_experience, notes: data.notes });
      if (data.certifications) setCertifications(data.certifications);
      if (data.project_history) setProjects(data.project_history);
    } catch {
      setForm({ name: '김철수', title: '부장', department: '기술팀', birth_date: '1985-03-15', resident_number: '850315-1000000', phone: '010-1234-5678', email: 'kim@company.com', education_level: '석사', education_school: 'OO대학교', education_major: '컴퓨터공학', graduation_year: 2010, hire_date: '2012-03-01', years_of_experience: 15, notes: '' });
      setCertifications(mockCerts);
      setProjects(mockProjs);
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('이름은 필수 입력항목입니다.'); return; }
    setSaving(true);
    try {
      if (isNew) { const c = await personnelApi.create(form); navigate('/personnel/' + c.id + '/edit'); }
      else if (id) { await personnelApi.update(parseInt(id), form); }
      alert('저장되었습니다.');
    } catch { alert('저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!id) return;
    try { await personnelApi.delete(parseInt(id)); navigate('/personnel'); } catch { alert('삭제 실패'); }
  };

  const handleAddCert = async () => {
    if (!certForm.cert_name.trim()) { alert('자격증명은 필수입니다.'); return; }
    const nc: Certification = { id: Date.now(), cert_name: certForm.cert_name, cert_number: certForm.cert_number || '', cert_date: certForm.cert_date || null, cert_issuer: certForm.cert_issuer || '', cert_file_path: null, has_file: !!certForm.file };
    if (!isNew && id) {
      try { const fd = new FormData(); fd.append('cert_name', certForm.cert_name); if (certForm.cert_number) fd.append('cert_number', certForm.cert_number); if (certForm.cert_date) fd.append('cert_date', certForm.cert_date); if (certForm.cert_issuer) fd.append('cert_issuer', certForm.cert_issuer); if (certForm.file) fd.append('file', certForm.file); const cr = await certificationApi.create(parseInt(id), fd); setCertifications([...certifications, cr]); }
      catch { setCertifications([...certifications, nc]); }
    } else { setCertifications([...certifications, nc]); }
    setCertForm({ cert_name: '', cert_number: '', cert_date: '', cert_issuer: '', file: null });
    setShowCertModal(false);
  };

  const handleDeleteCert = async (cid: number) => {
    if (!isNew && id) { try { await certificationApi.delete(parseInt(id), cid); } catch {} }
    setCertifications(certifications.filter((c) => c.id !== cid));
  };

  const handleSaveProject = async () => {
    if (!projectForm.project_name.trim()) { alert('프로젝트명은 필수입니다.'); return; }
    if (editingProjectId) {
      if (!isNew && id) { try { const u = await projectHistoryApi.update(parseInt(id), editingProjectId, projectForm); setProjects(projects.map((p) => p.id === editingProjectId ? u : p)); } catch { setProjects(projects.map((p) => p.id === editingProjectId ? { ...p, ...projectForm } as ProjectHistory : p)); } }
      else { setProjects(projects.map((p) => p.id === editingProjectId ? { ...p, ...projectForm } as ProjectHistory : p)); }
    } else {
      if (!isNew && id) { try { const c = await projectHistoryApi.create(parseInt(id), projectForm); setProjects([...projects, c]); } catch { setProjects([...projects, { id: Date.now(), ...projectForm } as ProjectHistory]); } }
      else { setProjects([...projects, { id: Date.now(), ...projectForm } as ProjectHistory]); }
    }
    setProjectForm({ project_name: '', client: '', role: '', start_date: '', end_date: '', budget: '', description: '' });
    setEditingProjectId(null); setShowProjectModal(false);
  };

  const handleDeleteProject = async (pid: number) => {
    if (!isNew && id) { try { await projectHistoryApi.delete(parseInt(id), pid); } catch {} }
    setProjects(projects.filter((p) => p.id !== pid));
  };

  const openEditProject = (proj: ProjectHistory) => {
    setEditingProjectId(proj.id);
    setProjectForm({ project_name: proj.project_name, client: proj.client, role: proj.role, start_date: proj.start_date || '', end_date: proj.end_date || '', budget: proj.budget, description: proj.description });
    setShowProjectModal(true);
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'basic', label: '기본정보' },
    { key: 'certifications', label: '자격증 (' + certifications.length + ')' },
    { key: 'projects', label: '프로젝트 이력 (' + projects.length + ')' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400">불러오는 중...</p></div>;
  const ic = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/personnel')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl font-bold text-gray-800">{isNew ? '인력 등록' : (form.name || '') + ' 정보 편집'}</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && <button onClick={() => setShowCertificateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"><FileText size={16} /> 재직증명서</button>}
          {!isNew && <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={16} /> 삭제</button>}
          <button onClick={() => navigate('/personnel')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"><Save size={16} /> {saving ? '저장중...' : '저장'}</button>
        </div>
      </div>
      <div className="border-b border-gray-200 mb-6"><nav className="flex gap-6">{tabs.map((tab) => (<button key={tab.key} onClick={() => setActiveTab(tab.key)} className={'pb-3 text-sm font-medium border-b-2 transition-colors ' + (activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>{tab.label}</button>))}</nav></div>

      {activeTab === 'basic' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={ic} placeholder="이름 입력" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">직급</label><input type="text" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} className={ic} placeholder="예: 부장" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">부서</label><input type="text" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} className={ic} placeholder="예: 기술팀" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label><input type="date" value={form.birth_date || ''} onChange={(e) => setForm({ ...form, birth_date: e.target.value || null })} className={ic} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">주민등록번호</label><input type="text" value={form.resident_number || ''} onChange={(e) => setForm({ ...form, resident_number: e.target.value })} className={ic} placeholder="예: 940815-2000000" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">연락처</label><input type="tel" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={ic} placeholder="010-0000-0000" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">이메일</label><input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className={ic} placeholder="example@company.com" /></div>
          </div>
          <hr className="my-6 border-gray-200" /><h3 className="text-sm font-semibold text-gray-800 mb-4">학력</h3>
          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">학력</label><select value={form.education_level || ''} onChange={(e) => setForm({ ...form, education_level: e.target.value })} className={ic}><option value="">선택</option>{eduLevels.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">학교</label><input type="text" value={form.education_school || ''} onChange={(e) => setForm({ ...form, education_school: e.target.value })} className={ic} placeholder="OO대학교" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">전공</label><input type="text" value={form.education_major || ''} onChange={(e) => setForm({ ...form, education_major: e.target.value })} className={ic} placeholder="컴퓨터공학" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">졸업년도</label><input type="number" value={form.graduation_year || ''} onChange={(e) => setForm({ ...form, graduation_year: e.target.value ? parseInt(e.target.value) : null })} className={ic} placeholder="2010" /></div>
          </div>
          <hr className="my-6 border-gray-200" /><h3 className="text-sm font-semibold text-gray-800 mb-4">경력</h3>
          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">입사일</label><input type="date" value={form.hire_date || ''} onChange={(e) => setForm({ ...form, hire_date: e.target.value || null })} className={ic} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">총 경력 (년)</label><input type="number" value={form.years_of_experience || 0} onChange={(e) => setForm({ ...form, years_of_experience: parseInt(e.target.value) || 0 })} className={ic} min={0} /></div>
          </div>
          <hr className="my-6 border-gray-200" />
          <div><label className="block text-sm font-medium text-gray-700 mb-1">비고</label><textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={ic + ' resize-none'} placeholder="추가 메모..." /></div>
        </div>
      )}

      {activeTab === 'certifications' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">자격증 목록</h3>
            <button onClick={() => { setCertForm({ cert_name: '', cert_number: '', cert_date: '', cert_issuer: '', file: null }); setShowCertModal(true); }} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"><Plus size={14} /> 자격증 추가</button>
          </div>
          {certifications.length === 0 ? <p className="text-center text-gray-400 py-8">등록된 자격증이 없습니다.</p> : (
            <table className="w-full"><thead><tr className="border-b border-gray-200">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">자격증명</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">자격번호</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">취득일</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">발급기관</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">파일</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">관리</th>
            </tr></thead><tbody className="divide-y divide-gray-100">{certifications.map((cert) => (
              <tr key={cert.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{cert.cert_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{cert.cert_number || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{cert.cert_date || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{cert.cert_issuer || '-'}</td>
                <td className="px-4 py-3">{cert.has_file ? <button className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Download size={14} /></button> : <span className="text-xs text-gray-400">없음</span>}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteCert(cert.id)} className="p-1 text-gray-400 hover:text-red-600 rounded"><X size={14} /></button></td>
              </tr>))}</tbody></table>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">프로젝트 이력</h3>
            <button onClick={() => { setEditingProjectId(null); setProjectForm({ project_name: '', client: '', role: '', start_date: '', end_date: '', budget: '', description: '' }); setShowProjectModal(true); }} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"><Plus size={14} /> 프로젝트 추가</button>
          </div>
          {projects.length === 0 ? <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">등록된 프로젝트 이력이 없습니다.</div> : projects.map((proj) => (
            <div key={proj.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 mb-2">{proj.project_name}</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mb-1">
                    <span>발주: {proj.client || '-'}</span><span className="text-gray-300">|</span><span>{proj.role || '-'}</span><span className="text-gray-300">|</span><span>{proj.start_date || '?'} ~ {proj.end_date || '?'}</span>
                    {proj.budget && <><span className="text-gray-300">|</span><span>{proj.budget}</span></>}
                  </div>
                  {proj.description && <p className="text-sm text-gray-600 mt-1">{proj.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button onClick={() => openEditProject(proj)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteProject(proj.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCertModal} onClose={() => setShowCertModal(false)} title="자격증 추가">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">자격증명 *</label><input type="text" value={certForm.cert_name} onChange={(e) => setCertForm({ ...certForm, cert_name: e.target.value })} className={ic} placeholder="예: 정보관리기술사" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">자격번호</label><input type="text" value={certForm.cert_number || ''} onChange={(e) => setCertForm({ ...certForm, cert_number: e.target.value })} className={ic} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">취득일</label><input type="date" value={certForm.cert_date || ''} onChange={(e) => setCertForm({ ...certForm, cert_date: e.target.value })} className={ic} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">발급기관</label><input type="text" value={certForm.cert_issuer || ''} onChange={(e) => setCertForm({ ...certForm, cert_issuer: e.target.value })} className={ic} placeholder="예: 한국산업인력공단" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">증빙 파일 (PDF)</label><input type="file" accept=".pdf" onChange={(e) => setCertForm({ ...certForm, file: e.target.files?.[0] || null })} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCertModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
            <button onClick={handleAddCert} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">추가</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title={editingProjectId ? '프로젝트 편집' : '프로젝트 추가'} size="lg">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">프로젝트명 *</label><input type="text" value={projectForm.project_name} onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })} className={ic} placeholder="프로젝트명 입력" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">발주처</label><input type="text" value={projectForm.client || ''} onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })} className={ic} placeholder="예: OO시" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">역할</label><input type="text" value={projectForm.role || ''} onChange={(e) => setProjectForm({ ...projectForm, role: e.target.value })} className={ic} placeholder="예: PM, PL" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">시작일</label><input type="date" value={projectForm.start_date || ''} onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })} className={ic} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">종료일</label><input type="date" value={projectForm.end_date || ''} onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })} className={ic} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">사업규모</label><input type="text" value={projectForm.budget || ''} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} className={ic} placeholder="예: 5억원" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">업무내용</label><textarea value={projectForm.description || ''} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} rows={3} className={ic + ' resize-none'} placeholder="담당한 업무 내용..." /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
            <button onClick={handleSaveProject} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">{editingProjectId ? '수정' : '추가'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} title="인력 삭제" message="이 인력 정보를 삭제하시겠습니까? 관련된 자격증, 프로젝트 이력도 함께 삭제됩니다." confirmLabel="삭제" variant="danger" />

      <EmploymentCertificateModal isOpen={showCertificateModal} onClose={() => setShowCertificateModal(false)} personnel={form} />
    </div>
  );
}
