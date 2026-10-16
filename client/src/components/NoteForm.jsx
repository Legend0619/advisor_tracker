import { useState } from 'react';
import { useApp } from '../App.jsx';
import { api } from '../api.js';

export default function NoteForm({ student, onSaved }) {
  const { meta, viewingAs } = useApp();
  const blank = {
    contact_date: meta.today,
    contact_type: student.briefing.channelHint?.startsWith('Phone') ? 'Phone' : 'In person',
    advisor: viewingAs || student.advisor,
    text: '',
    sensitive: false,
    follow_up_date: '',
  };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await api.addNote(student.id, { ...form, follow_up_date: form.follow_up_date || null });
      const extras = [];
      if (res.redactions.length) extras.push(`${res.redactions.join(', ')} removed before saving — don't put IDs in notes.`);
      if (res.autoSensitive) extras.push('Marked sensitive because it mentions health or a privacy request.');
      setStatus({ ok: true, text: ['Contact logged.', ...extras].join(' ') });
      setErrors({});
      setForm(blank);
      onSaved();
    } catch (err) {
      setErrors(err.fields || {});
      setStatus({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card note-form" onSubmit={submit} id="log" noValidate>
      <h2>Log a contact</h2>
      <div className="grid2">
        <Field label="Date" error={errors.contact_date}>
          <input type="date" value={form.contact_date} max={meta.today} onChange={set('contact_date')} required />
        </Field>
        <Field label="Type" error={errors.contact_type}>
          <select value={form.contact_type} onChange={set('contact_type')}>
            {meta.contactTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Advisor" error={errors.advisor}>
          <select value={form.advisor} onChange={set('advisor')}>
            {meta.advisors.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Follow up by (optional)" error={errors.follow_up_date}>
          <input type="date" value={form.follow_up_date} min={form.contact_date} onChange={set('follow_up_date')} />
        </Field>
      </div>
      <Field label="What was discussed / next steps" error={errors.text}>
        <textarea rows={4} value={form.text} onChange={set('text')}
          placeholder="e.g. Discussed tutoring for Accounting II. Student will book by Friday." />
      </Field>
      <label className="check">
        <input type="checkbox" checked={form.sensitive} onChange={set('sensitive')} />
        Sensitive (health, counselling, personal) — hide by default and keep out of summaries
      </label>
      <div className="row-between">
        <span className={status ? (status.ok ? 'ok' : 'error') : ''} role="status">{status?.text}</span>
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save contact'}</button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span>{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
