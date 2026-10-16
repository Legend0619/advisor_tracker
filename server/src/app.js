import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { CLIENT_DIST, CONTACT_TYPES, TODAY } from './config.js';
import { isIsoDate } from './dates.js';
import { assess, briefing } from './outreach.js';
import { looksSensitive, redactPII } from './text.js';

export function createApp(db, today = TODAY) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  const q = {
    students: db.prepare('SELECT * FROM students ORDER BY last_name, first_name'),
    student: db.prepare('SELECT * FROM students WHERE id = ?'),
    allNotes: db.prepare('SELECT * FROM notes ORDER BY contact_date DESC, created_at DESC, id DESC'),
    notesFor: db.prepare(
      'SELECT * FROM notes WHERE student_id = ? ORDER BY contact_date DESC, created_at DESC, id DESC',
    ),
    issuesFor: db.prepare('SELECT * FROM data_issues WHERE student_id = ? ORDER BY id'),
    issues: db.prepare(`SELECT i.*, s.first_name, s.last_name FROM data_issues i
      LEFT JOIN students s ON s.id = i.student_id ORDER BY
      CASE i.severity WHEN 'action' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, i.id`),
    issueStudents: db.prepare(
      "SELECT DISTINCT student_id, kind FROM data_issues WHERE student_id IS NOT NULL AND severity = 'action'",
    ),
    maxNoteNum: db.prepare("SELECT MAX(CAST(SUBSTR(id, 2) AS INTEGER)) AS n FROM notes WHERE id LIKE 'N%'"),
    insertNote: db.prepare(`INSERT INTO notes
      (id, student_id, contact_date, contact_type, advisor, text, sensitive, follow_up_date, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'app')`),
    advisors: db.prepare('SELECT DISTINCT advisor FROM students ORDER BY advisor'),
    majors: db.prepare('SELECT DISTINCT major FROM students ORDER BY major'),
  };

  // 50 students: compute everything per request. At real scale this would be
  // a materialised view or nightly job.
  function summaries() {
    const notesBy = new Map();
    for (const n of q.allNotes.all()) {
      if (!notesBy.has(n.student_id)) notesBy.set(n.student_id, []);
      notesBy.get(n.student_id).push(n);
    }
    const flags = new Map();
    for (const { student_id, kind } of q.issueStudents.all()) {
      if (!flags.has(student_id)) flags.set(student_id, []);
      flags.get(student_id).push(kind);
    }
    return q.students.all().map((s) => {
      const notes = notesBy.get(s.id) || [];
      return {
        ...s,
        noteCount: notes.length,
        latestNote: notes[0] ? { date: notes[0].contact_date, type: notes[0].contact_type, sensitive: !!notes[0].sensitive } : null,
        flags: flags.get(s.id) || [],
        ...assess(s, notes, today),
      };
    });
  }

  app.get('/api/meta', (req, res) => {
    res.json({
      today,
      advisors: q.advisors.all().map((r) => r.advisor),
      majors: q.majors.all().map((r) => r.major),
      contactTypes: CONTACT_TYPES,
      riskFlags: ['High', 'Medium', 'Low'],
      classYears: ['Freshman', 'Sophomore', 'Junior', 'Senior'],
    });
  });

  app.get('/api/students', (req, res) => res.json(summaries()));

  app.get('/api/outreach', (req, res) => {
    const advisor = req.query.advisor;
    const list = summaries()
      .filter((s) => !advisor || s.advisor === advisor)
      .filter((s) => s.priority.score > 0)
      .sort((a, b) => b.priority.score - a.priority.score || (b.daysSince ?? 1e9) - (a.daysSince ?? 1e9));
    res.json(list);
  });

  app.get('/api/students/:id', (req, res) => {
    const s = q.student.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Student not found' });
    const notes = q.notesFor.all(s.id).map((n) => ({ ...n, sensitive: !!n.sensitive }));
    res.json({
      ...s,
      ...assess(s, notes, today),
      briefing: briefing(s, notes),
      notes,
      issues: q.issuesFor.all(s.id),
    });
  });

  app.post('/api/students/:id/notes', (req, res) => {
    const s = q.student.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Student not found' });

    const { contact_date, contact_type, advisor, text, sensitive, follow_up_date } = req.body || {};
    const errors = {};
    if (!isIsoDate(contact_date)) errors.contact_date = 'Enter a valid date.';
    else if (contact_date > today) errors.contact_date = 'Contact date cannot be in the future.';
    if (!CONTACT_TYPES.includes(contact_type)) errors.contact_type = `Choose one of: ${CONTACT_TYPES.join(', ')}.`;
    const advisors = q.advisors.all().map((r) => r.advisor);
    if (!advisors.includes(advisor)) errors.advisor = 'Choose an advisor.';
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed.length < 3) errors.text = 'Write a short note about the contact.';
    else if (trimmed.length > 5000) errors.text = 'Keep notes under 5,000 characters.';
    if (follow_up_date) {
      if (!isIsoDate(follow_up_date)) errors.follow_up_date = 'Enter a valid date.';
      else if (isIsoDate(contact_date) && follow_up_date < contact_date)
        errors.follow_up_date = 'Follow-up must be after the contact date.';
    }
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please fix the highlighted fields.', fields: errors });

    const { text: clean, redactions } = redactPII(trimmed);
    const autoSensitive = !sensitive && looksSensitive(clean);
    const id = 'N' + String((q.maxNoteNum.get().n || 0) + 1).padStart(3, '0');
    q.insertNote.run(id, s.id, contact_date, contact_type, advisor, clean, sensitive || autoSensitive ? 1 : 0, follow_up_date || null);

    res.status(201).json({ id, redactions, autoSensitive });
  });

  app.get('/api/data-issues', (req, res) => res.json(q.issues.all()));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built front end when it exists (npm start); in dev Vite serves it.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
