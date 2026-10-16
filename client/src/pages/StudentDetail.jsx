import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { daysAgo, fmtDate, fullName } from '../format.js';
import { Reasons, RiskBadge } from '../components/bits.jsx';
import NoteForm from '../components/NoteForm.jsx';

export default function StudentDetail() {
  const { id } = useParams();
  const { hash } = useLocation();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api.student(id).then(setS, (e) => setError(e.message)), [id]);
  useEffect(() => {
    setS(null);
    load();
  }, [load]);

  useEffect(() => {
    if (s && hash === '#log') document.getElementById('log')?.scrollIntoView({ behavior: 'smooth' });
  }, [s, hash]);

  if (error) return <p className="error">{error} <Link to="/students">Back to students</Link></p>;
  if (!s) return <p>Loading…</p>;

  const b = s.briefing;
  const actionIssues = s.issues.filter((i) => i.severity === 'action' && i.kind !== 'no_contact_date');

  return (
    <>
      <p className="small"><Link to="/">← Outreach</Link> · <Link to="/students">All students</Link></p>
      <div className="page-head">
        <div>
          <h1>{fullName(s)} <RiskBadge risk={s.risk_flag} /></h1>
          <p className="muted">
            {s.id} ·{' '}
            {b.channelHint?.startsWith('Phone') ? (
              <span className="overdue" title={b.channelHint}><s>{s.email}</s> (don't email)</span>
            ) : (
              <a href={`mailto:${s.email}`}>{s.email}</a>
            )}{' '}
            · {s.major} · {s.class_year} · {s.credits} credits ·
            GPA {s.gpa.toFixed(2)} · Advisor: {s.advisor}
          </p>
        </div>
      </div>

      {actionIssues.map((i) => (
        <div key={i.id} className="banner">⚠ {i.detail}</div>
      ))}

      <div className="detail-grid">
        <div>
          <section className="card briefing">
            <h2>Before you reach out</h2>
            <p>
              <strong>Last contact:</strong>{' '}
              {s.lastContact
                ? `${daysAgo(s.daysSince)} (${fmtDate(s.lastContact)}, ${s.lastContactType})`
                : 'Never — no contact on record'}
              {s.checkInDue && <span className="overdue"> · check-in due ({s.risk_flag} risk: every {s.cadence} days)</span>}
            </p>

            {b.channelHint && (
              <p className="hint"><strong>How to reach them:</strong> {b.channelHint}</p>
            )}
            {b.preferences.map((p) => (
              <p key={p.noteId + p.text} className="hint small">“{p.text}” <span className="muted">— {fmtDate(p.date)}</span></p>
            ))}

            {b.openItems.length > 0 && (
              <>
                <h3>Recent notes with open threads</h3>
                <ul className="open-items">
                  {b.openItems.map((o, i) => (
                    <li key={i}>{o.text} <span className="muted small">— {fmtDate(o.date)}</span></li>
                  ))}
                </ul>
              </>
            )}

            {s.priority.reasons.length > 0 && (
              <>
                <h3>Why they're on the outreach list <span className="muted">(score {s.priority.score})</span></h3>
                <Reasons reasons={s.priority.reasons} />
              </>
            )}

            {b.sensitiveCount > 0 && (
              <p className="sensitive-note small">
                🔒 {b.sensitiveCount} sensitive note{b.sensitiveCount > 1 ? 's' : ''} — not included above.
                Read before meeting; don't reference in email.
              </p>
            )}
          </section>

          <NoteForm student={s} onSaved={load} />
        </div>

        <section>
          <h2>Contact history <span className="muted">({s.notes.length})</span></h2>
          {s.notes.length === 0 && <p className="muted">No contacts logged yet.</p>}
          <ol className="timeline">
            {s.notes.map((n) => <Note key={n.id} note={n} />)}
          </ol>
        </section>
      </div>
    </>
  );
}

function Note({ note }) {
  const [open, setOpen] = useState(!note.sensitive);
  return (
    <li className={`card note ${note.sensitive ? 'is-sensitive' : ''}`}>
      <div className="row-between small">
        <span>
          <strong>{fmtDate(note.contact_date)}</strong> · {note.contact_type} · {note.advisor}
        </span>
        <span className="muted">
          {note.sensitive && '🔒 Sensitive · '}
          {note.source === 'app' ? 'Logged here' : 'Imported'} · {note.id}
        </span>
      </div>
      {open ? (
        <p>{note.text}</p>
      ) : (
        <button className="link-btn" onClick={() => setOpen(true)}>Show sensitive note</button>
      )}
      {note.follow_up_date && <p className="small"><strong>Follow up by:</strong> {fmtDate(note.follow_up_date)}</p>}
    </li>
  );
}
