import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import SearchBar from '../components/common/SearchBar';
import Pagination from '../components/common/Pagination';
import { personnelApi } from '../services/api';
import type { PersonnelSummary } from '../types';

const mockData: PersonnelSummary[] = [
  { id: 1, name: '김철수', title: '부장', department: '기술팀', years_of_experience: 15, certification_count: 3, project_count: 8 },
  { id: 2, name: '이영희', title: '차장', department: '기술팀', years_of_experience: 10, certification_count: 2, project_count: 5 },
  { id: 3, name: '박민수', title: '과장', department: '개발팀', years_of_experience: 7, certification_count: 1, project_count: 4 },
  { id: 4, name: '최지은', title: '대리', department: '기획팀', years_of_experience: 4, certification_count: 1, project_count: 2 },
  { id: 5, name: '정현우', title: '과장', department: '기술팀', years_of_experience: 8, certification_count: 2, project_count: 6 },
];

const departments = ['전체', '기술팀', '개발팀', '기획팀'];

export default function PersonnelList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PersonnelSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('전체');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size: pageSize };
      if (search) params.search = search;
      if (department !== '전체') params.department = department;
      const response = await personnelApi.list(params);
      setItems(response.items);
      setTotal(response.total);
    } catch {
      let filtered = [...mockData];
      if (search) {
        filtered = filtered.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
      }
      if (department !== '전체') {
        filtered = filtered.filter((p) => p.department === department);
      }
      setItems(filtered);
      setTotal(filtered.length);
    } finally {
      setLoading(false);
    }
  }, [page, search, department]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, department]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">인력 목록</h2>
          <p className="text-sm text-gray-500 mt-1">등록된 인력 {total}명</p>
        </div>
        <Link
          to="/personnel/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          인력 추가
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 max-w-sm">
          <SearchBar value={search} onChange={setSearch} placeholder="이름으로 검색..." />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {departments.map((d) => (
            <option key={d} value={d}>부서: {d}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">이름</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">직급</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">부서</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">경력</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">자격증</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">프로젝트</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">등록된 인력이 없습니다.</td>
              </tr>
            ) : (
              items.map((person) => (
                <tr
                  key={person.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate("/personnel/" + person.id + "/edit")}
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">{person.name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{person.title || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{person.department || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{person.years_of_experience ?? '-'}년</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {person.certification_count}건
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {person.project_count}건
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate("/personnel/" + person.id + "/edit"); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="편집"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
