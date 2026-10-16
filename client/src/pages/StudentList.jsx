import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import { fullName } from '../format.js';
import { Flags, LastContact, RiskBadge } from '../components/bits.jsx';

const CONTACT_FILTERS = {
  '': 'Any',
  due: 'Due for check-in',
  never: 'Never contacted',
  30: 'Not in 30+ days',
  60: 'Not in 60+ days',
  90: 'Not in 90+ days',
};

const SORTS = {
  priority: (a, b) => b.priority.score - a.priority.score,
  name: (a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
  contact: (a, b) => (b.daysSince ?? 1e9) - (a.daysSince ?? 1e9),
  gpa: (a, b) => a.gpa - b.gpa,
};

export default function StudentList() {
  const { meta, viewingAs } = useApp();
  const [students, setStudents] = useState(null);
  const [error, setError] = useState(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // Filters live in the URL so Back from a student returns to the same view.
  const f = {
    q: params.get('q') || '',
    advisor: params.has('advisor') ? params.get('advisor') : viewingAs,
    risk: params.get('risk') || '',
    year: params.get('year') || '',
    major: params.get('major') || '',
    contact: params.get('contact') || '',
    sort: params.get('sort') || 'priority',
  };
  const set = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    api.students().then(setStudents, (e) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!students) return [];
    const q = f.q.trim().toLowerCase();
    return students
      .filter((s) => {
        if (q && !`${s.first_name} ${s.last_name} ${s.id} ${s.email} ${s.major}`.toLowerCase().includes(q)) return false;
        if (f.advisor && s.advisor !== f.advisor) return false;
        if (f.risk && s.risk_flag !== f.risk) return false;
        if (f.year && s.class_year !== f.year) return false;
        if (f.major && s.major !== f.major) return false;
        if (f.contact === 'due' && !s.checkInDue) return false;
        if (f.contact === 'never' && s.daysSince != null) return false;
        if (/^\d+$/.test(f.contact) && s.daysSince != null && s.daysSince < Number(f.contact)) return false;
        return true;
      })
      .sort(SORTS[f.sort] || SORTS.priority);
  }, [students, params, viewingAs]);

  if (error) return <p className="error">{error}</p>;
  if (!students) return <p>Loading…</p>;

  return (
    <>
      <div className="page-head">
        <h1>Students</h1>
        <span className="muted">{rows.length} of {students.length}</span>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search name, ID, email, major…"
          value={f.q}
          onChange={(e) => set('q', e.target.value)}
          autoFocus
        />
        <Select label="Advisor" value={f.advisor} onChange={(v) => set('advisor', v)} options={meta.advisors} anyLabel="All" />
        <Select label="Risk" value={f.risk} onChange={(v) => set('risk', v)} options={meta.riskFlags} />
        <Select label="Year" value={f.year} onChange={(v) => set('year', v)} options={meta.classYears} />
        <Select label="Major" value={f.major} onChange={(v) => set('major', v)} options={meta.majors} />
        <label>
          Last contact
          <select value={f.contact} onChange={(e) => set('contact', e.target.value)}>
            {Object.entries(CONTACT_FILTERS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={f.sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="priority">Outreach priority</option>
            <option value="contact">Longest since contact</option>
            <option value="name">Name</option>
            <option value="gpa">GPA (lowest first)</option>
          </select>
        </label>
        {[...params.keys()].length > 0 && (
          <button className="link-btn" onClick={() => setParams({}, { replace: true })}>Clear</button>
        )}
      </div>

      <table className="students">
        <thead>
          <tr>
            <th>Name</th>
            <th>Major</th>
            <th>Year</th>
            <th className="num">GPA</th>
            <th>Risk</th>
            <th>Advisor</th>
            <th>Last contact</th>
            <th className="num" title="Outreach priority score">Priority</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)} tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/students/${s.id}`)}>
              <td>
                <strong>{fullName(s)}</strong> <span className="muted small">{s.id}</span> <Flags flags={s.flags} />
              </td>
              <td>{s.major}</td>
              <td>{s.class_year}</td>
              <td className="num">{s.gpa.toFixed(2)}</td>
              <td><RiskBadge risk={s.risk_flag} /></td>
              <td>{s.advisor}</td>
              <td><LastContact student={s} /></td>
              <td className="num">{s.priority.score || ''}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="muted">No students match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function Select({ label, value, onChange, options, anyLabel = 'Any' }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
