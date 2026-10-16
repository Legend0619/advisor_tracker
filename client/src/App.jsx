import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import { fmtDate } from './format.js';
import Outreach from './pages/Outreach.jsx';
import StudentList from './pages/StudentList.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import DataIssues from './pages/DataIssues.jsx';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function loadAdvisor() {
  try {
    return localStorage.getItem('viewingAs') || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  // No auth in the prototype: the advisor picks who they are, and the app
  // remembers it. It scopes the outreach list and pre-fills new notes.
  const [viewingAs, setViewingAsState] = useState(loadAdvisor);

  const setViewingAs = (a) => {
    setViewingAsState(a);
    try {
      localStorage.setItem('viewingAs', a);
    } catch {}
  };

  useEffect(() => {
    api.meta().then(setMeta, (e) => setError(e.message));
  }, []);

  if (error)
    return (
      <div className="page">
        <p className="error">Could not reach the API: {error}. Is the server running on port 3001?</p>
      </div>
    );
  if (!meta) return <div className="page">Loading…</div>;

  return (
    <AppContext.Provider value={{ meta, viewingAs, setViewingAs }}>
      <header className="topbar">
        <div className="brand">Advisor Tracker</div>
        <nav>
          <NavLink to="/" end>Outreach</NavLink>
          <NavLink to="/students">Students</NavLink>
          <NavLink to="/data-issues">Data issues</NavLink>
        </nav>
        <div className="topbar-right">
          <span className="muted small">Today: {fmtDate(meta.today)}</span>
          <label className="viewing-as">
            I am
            <select value={viewingAs} onChange={(e) => setViewingAs(e.target.value)}>
              <option value="">All advisors</option>
              {meta.advisors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Outreach />} />
          <Route path="/students" element={<StudentList />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/data-issues" element={<DataIssues />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </AppContext.Provider>
  );
}
