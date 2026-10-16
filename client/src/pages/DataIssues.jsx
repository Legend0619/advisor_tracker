import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const SEVERITY = { action: 'Needs a person', warning: 'Warning', info: 'Handled automatically' };

export default function DataIssues() {
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.dataIssues().then(setIssues, (e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!issues) return <p>Loading…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Data issues</h1>
          <p className="muted">
            What the importer found in the source spreadsheets and what it did about it. Nothing was silently dropped.
          </p>
        </div>
      </div>
      <table className="students issues">
        <thead>
          <tr><th>Severity</th><th>Student</th><th>Issue</th></tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.id} className={`sev-${i.severity}`}>
              <td><span className={`badge sev-${i.severity}`}>{SEVERITY[i.severity]}</span></td>
              <td>
                {i.student_id ? (
                  <Link to={`/students/${i.student_id}`}>
                    {i.first_name} {i.last_name} <span className="muted small">{i.student_id}</span>
                  </Link>
                ) : '—'}
              </td>
              <td>{i.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
