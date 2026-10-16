import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { DATASET_DIR } from './config.js';
import { parseDate } from './dates.js';
import { redactPII, looksSensitive } from './text.js';

function readCsv(file) {
  return parse(fs.readFileSync(file, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

const YEAR_CREDITS = {
  Freshman: [0, 29],
  Sophomore: [30, 59],
  Junior: [60, 89],
  Senior: [90, Infinity],
};

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length][b.length];
}

/**
 * Load students.csv + contact_notes.csv into an empty database, cleaning as
 * we go and recording every judgement call in data_issues.
 */
export function importDataset(db, dir = DATASET_DIR) {
  const students = readCsv(path.join(dir, 'students.csv'));
  const notes = readCsv(path.join(dir, 'contact_notes.csv'));

  const issues = [];
  const issue = (kind, severity, detail, student_id = null, note_id = null) =>
    issues.push({ kind, severity, detail, student_id, note_id });

  const readme = path.join(dir, 'README.txt');
  if (fs.existsSync(readme) && fs.statSync(readme).size === 0)
    issue('missing_docs', 'info', 'README.txt in the dataset is empty; column meanings were inferred from headers.');

  const insStudent = db.prepare(`INSERT INTO students
    (id, first_name, last_name, email, major, class_year, credits, gpa, advisor, risk_flag, csv_last_contact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insNote = db.prepare(`INSERT INTO notes
    (id, student_id, contact_date, contact_type, advisor, text, sensitive, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'import')`);
  const insIssue = db.prepare(`INSERT INTO data_issues (kind, severity, student_id, note_id, detail)
    VALUES (?, ?, ?, ?, ?)`);

  const byId = new Map();
  let reformattedStudentDates = 0;

  for (const r of students) {
    if (byId.has(r.student_id)) {
      issue('duplicate_id', 'warning', `Duplicate student_id ${r.student_id}; second row skipped.`, r.student_id);
      continue;
    }
    const raw = r.last_contact_date;
    const iso = parseDate(raw);
    if (iso && iso !== raw) reformattedStudentDates++;
    if (!iso) {
      issue(
        'no_contact_date',
        'action',
        raw
          ? `last_contact_date is "${raw}" (the README says never-contacted should be blank) and there are no contact notes — treated as never contacted.`
          : 'last_contact_date is blank and there are no contact notes — treated as never contacted.',
        r.student_id,
      );
    }
    const gpa = Number(r.gpa);
    if (!(gpa >= 0 && gpa <= 4)) issue('bad_gpa', 'warning', `GPA "${r.gpa}" is outside 0–4.`, r.student_id);
    const credits = Number(r.credits_earned);
    const band = YEAR_CREDITS[r.class_year];
    if (band && !(credits >= band[0] && credits <= band[1]))
      issue('year_credits', 'info', `${r.class_year} with ${credits} credits — class year may be out of date.`, r.student_id);

    byId.set(r.student_id, { ...r, iso });
    insStudent.run(
      r.student_id, r.first_name, r.last_name, r.email, r.major, r.class_year,
      credits, gpa, r.advisor, r.risk_flag, iso,
    );
  }
  if (reformattedStudentDates)
    issue('date_format', 'info', `students.csv: the dataset README specifies YYYY-MM-DD, but ${reformattedStudentDates} last_contact_date values used other formats (e.g. "Aug 25, 2026", "30-Aug-2026", "2026/09/02"). Normalised to YYYY-MM-DD.`);

  // Possible duplicate people: same surname, major and class year, near-identical first name.
  const list = [...byId.values()];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (
        a.last_name.toLowerCase() === b.last_name.toLowerCase() &&
        a.major === b.major &&
        a.class_year === b.class_year &&
        editDistance(a.first_name.toLowerCase(), b.first_name.toLowerCase()) <= 2
      ) {
        const detail = `${a.first_name} ${a.last_name} (${a.student_id}, ${a.advisor}) and ${b.first_name} ${b.last_name} (${b.student_id}, ${b.advisor}) share surname, major and year (GPA ${a.gpa} vs ${b.gpa}). Possibly the same student with two records and two advisors — confirm with the registrar before merging.`;
        issue('possible_duplicate', 'action', detail, a.student_id);
        issue('possible_duplicate', 'action', detail, b.student_id);
      }
    }

  // Notes
  let reformattedNoteDates = 0;
  const lastFromNotes = new Map();
  for (const n of notes) {
    if (!byId.has(n.student_id)) {
      issue('orphan_note', 'warning', `Note ${n.note_id} refers to unknown student ${n.student_id}; skipped.`, null, n.note_id);
      continue;
    }
    const iso = parseDate(n.contact_date);
    if (!iso) {
      issue('bad_note_date', 'warning', `Note ${n.note_id} has unreadable date "${n.contact_date}"; skipped.`, n.student_id, n.note_id);
      continue;
    }
    if (iso !== n.contact_date) reformattedNoteDates++;

    const { text, redactions } = redactPII(n.note_text);
    if (redactions.length)
      issue('pii_redacted', 'action', `Note ${n.note_id} contained ${redactions.join(', ')}; redacted on import. The source CSV still contains it and should be purged.`, n.student_id, n.note_id);

    const sensitive = looksSensitive(text);
    if (sensitive)
      issue('sensitive_note', 'info', `Note ${n.note_id} mentions health/counselling or a privacy request; marked sensitive and hidden by default.`, n.student_id, n.note_id);

    const student = byId.get(n.student_id);
    if (student.advisor !== n.advisor)
      issue('advisor_mismatch', 'info', `Note ${n.note_id} was logged by ${n.advisor}, but the student's advisor is ${student.advisor}.`, n.student_id, n.note_id);

    insNote.run(n.note_id, n.student_id, iso, n.contact_type, n.advisor, text, sensitive ? 1 : 0);
    if (!lastFromNotes.has(n.student_id) || lastFromNotes.get(n.student_id) < iso)
      lastFromNotes.set(n.student_id, iso);
  }
  if (reformattedNoteDates)
    issue('date_format', 'info', `contact_notes.csv: the dataset README specifies YYYY-MM-DD, but ${reformattedNoteDates} contact_date values used other formats. Normalised to YYYY-MM-DD.`);

  // The CSV's last_contact_date duplicates information in the notes. Check they agree.
  for (const s of byId.values()) {
    const fromNotes = lastFromNotes.get(s.student_id) || null;
    if (s.iso && fromNotes && s.iso !== fromNotes)
      issue('last_contact_mismatch', 'warning', `students.csv says last contact ${s.iso}, latest note is ${fromNotes}. Using the later of the two.`, s.student_id);
    if (s.iso && !fromNotes)
      issue('last_contact_no_note', 'info', `students.csv says last contact ${s.iso} but there is no note for it.`, s.student_id);
  }

  for (const i of issues) insIssue.run(i.kind, i.severity, i.student_id, i.note_id, i.detail);
  return { students: byId.size, notes: notes.length, issues: issues.length };
}
