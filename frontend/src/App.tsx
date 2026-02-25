import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import PersonnelList from './pages/PersonnelList';
import PersonnelEdit from './pages/PersonnelEdit';
import BidList from './pages/BidList';
import BidWorkspace from './pages/BidWorkspace';
import PageEditor from './pages/PageEditor';
import Library from './pages/Library';
import Settings from './pages/Settings';
import HwpConverter from './pages/HwpConverter';

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
          <Route path="/bids/:bidId/workspace" element={<BidWorkspace />} />
          <Route path="/editor" element={<PageEditor />} />
          <Route path="/bids/:bidId/pages/:pageId/edit" element={<PageEditor />} />
          <Route path="/library" element={<Library />} />
          <Route path="/hwp" element={<HwpConverter />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
