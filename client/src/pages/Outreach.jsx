import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import { fullName } from '../format.js';
import { Flags, LastContact, Reasons, RiskBadge } from '../components/bits.jsx';

const PAGE = 10;

export default function Outreach() {
  const { viewingAs } = useApp();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setList(null);
    api.outreach(viewingAs).then(setList, (e) => setError(e.message));
  }, [viewingAs]);

  if (error) return <p className="error">{error}</p>;
  if (!list) return <p>Loading…</p>;

  const shown = showAll ? list : list.slice(0, PAGE);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Who to contact next</h1>
          <p className="muted">
            {viewingAs ? `${viewingAs}'s students` : 'All advisors'}, ranked by how much they need a check-in.
            Every point is explained, so you can disagree with it.
          </p>
        </div>
      </div>

      {list.length === 0 && <p>Nobody needs outreach right now.</p>}

      <ol className="outreach">
        {shown.map((s, i) => (
          <li key={s.id} className="card">
            <div className="rank">{i + 1}</div>
            <div className="outreach-main">
              <div className="row-between">
                <div>
                  <Link to={`/students/${s.id}`} className="name">{fullName(s)}</Link>{' '}
                  <span className="muted small">{s.id} · {s.major} · {s.class_year} · Advisor: {s.advisor}</span>
                </div>
                <div className="score" title="Priority score">{s.priority.score}</div>
              </div>
              <div className="small meta-line">
                <RiskBadge risk={s.risk_flag} /> GPA {s.gpa.toFixed(2)} · Last contact: <LastContact student={s} />{' '}
                <Flags flags={s.flags} />
              </div>
              <Reasons reasons={s.priority.reasons} />
              <Link to={`/students/${s.id}#log`} className="button small-btn">Open briefing &amp; log contact</Link>
            </div>
          </li>
        ))}
      </ol>
      {list.length > PAGE && (
        <button className="link-btn" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show top 10' : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}
