import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import PersonnelList from './pages/PersonnelList';
import PersonnelEdit from './pages/PersonnelEdit';
import BidList from './pages/BidList';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/personnel" element={<PersonnelList />} />
          <Route path="/personnel/new" element={<PersonnelEdit />} />
          <Route path="/personnel/:id/edit" element={<PersonnelEdit />} />
          <Route path="/bids" element={<BidList />} />
          <Route path="/library" element={<div className="text-center py-20 text-gray-400">장표 보관함 (Phase 2에서 구현 예정)</div>} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
