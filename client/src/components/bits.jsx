import { daysAgo, fmtDate } from '../format.js';

export function RiskBadge({ risk }) {
  return <span className={`badge risk-${risk?.toLowerCase()}`}>{risk}</span>;
}

export function LastContact({ student }) {
  const { lastContact, daysSince, checkInDue } = student;
  return (
    <span className={checkInDue ? 'overdue' : ''} title={lastContact ? fmtDate(lastContact) : 'No contact on record'}>
      {daysAgo(daysSince)}
      {lastContact && <span className="muted small"> · {fmtDate(lastContact)}</span>}
    </span>
  );
}

export function Reasons({ reasons }) {
  return (
    <ul className="reasons">
      {reasons.map((r, i) => (
        <li key={i}>
          <span className="pts">+{r.points}</span>
          <span>
            <strong>{r.label}</strong>
            {r.detail && <span className="muted"> — {r.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const FLAG_LABELS = {
  possible_duplicate: 'Possible duplicate record',
  no_contact_date: 'No contact on record',
  pii_redacted: 'PII was redacted',
};

export function Flags({ flags }) {
  const shown = [...new Set(flags)].filter((f) => FLAG_LABELS[f] && f !== 'no_contact_date');
  return shown.map((f) => (
    <span key={f} className="badge flag" title={FLAG_LABELS[f]}>
      ⚠ {FLAG_LABELS[f]}
    </span>
  ));
}
