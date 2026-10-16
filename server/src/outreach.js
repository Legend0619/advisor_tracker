// The "smart" feature: a transparent outreach priority score plus a pre-call
// briefing. Rule-based on purpose — every point is explained in the UI, it
// runs offline, and no student data leaves the building.

import { CHECK_IN_DAYS } from './config.js';
import { daysBetween } from './dates.js';
import { findCue, looksSensitive, sentences } from './text.js';

const safe = (sentencesList) => sentencesList.filter((s) => !looksSensitive(s));

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "by Oct 15" written in a note dated 2026-09-11 -> "2026-10-15". */
function deadlineIn(text, noteDate) {
  const m = text.match(/\bby (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})\b/i);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  let year = Number(noteDate.slice(0, 4));
  const pad = (n) => String(n).padStart(2, '0');
  let iso = `${year}-${pad(month)}-${pad(Number(m[2]))}`;
  if (iso < noteDate) iso = `${year + 1}-${iso.slice(5)}`; // "by Jan 10" written in November
  return iso;
}

/**
 * @param student  row from students
 * @param notes    that student's notes, newest first
 * @param today    ISO date
 */
export function assess(student, notes, today) {
  const latest = notes[0] || null;
  const lastContact = latest?.contact_date || student.csv_last_contact || null;
  const daysSince = lastContact ? daysBetween(lastContact, today) : null;
  const cadence = CHECK_IN_DAYS[student.risk_flag] ?? 60;

  const reasons = [];
  const add = (points, label, detail) => reasons.push({ points, label, detail });

  // 1. Advisor-set follow-up date on the most recent note.
  if (latest?.follow_up_date) {
    const d = daysBetween(today, latest.follow_up_date);
    if (d < 0) add(35, `Follow-up overdue by ${-d} day${d === -1 ? '' : 's'}`, `Set on ${latest.contact_date}`);
    else if (d === 0) add(30, 'Follow-up due today', `Set on ${latest.contact_date}`);
    else if (d <= 7) add(15, `Follow-up due in ${d} day${d === 1 ? '' : 's'}`, latest.follow_up_date);
  }

  // 2. Time since last contact, relative to the risk tier's check-in rhythm.
  if (daysSince == null) {
    add(40, 'Never contacted', 'No contact on record');
  } else if (daysSince > cadence) {
    add(
      15 + Math.min(Math.floor((daysSince - cadence) / 7) * 2, 20),
      `${daysSince} days since last contact`,
      `${student.risk_flag}-risk students: check in every ${cadence} days`,
    );
  }

  // 3. Standing risk.
  if (student.risk_flag === 'High') add(20, 'High risk flag');
  else if (student.risk_flag === 'Medium') add(8, 'Medium risk flag');
  if (student.gpa < 2.0) add(15, `GPA ${student.gpa.toFixed(2)}`, 'Below 2.0 good-standing line');
  else if (student.gpa < 2.5) add(8, `GPA ${student.gpa.toFixed(2)}`);

  // 4. What the last conversation left open. Only the latest note counts: if
  // a newer note exists, the earlier loose end is assumed handled.
  if (latest) {
    const waiting = safe(findCue('awaitingReply', latest.text));
    if (waiting.length) add(15, `Waiting on student since ${latest.contact_date}`, waiting[0]);
    const urgent = safe(findCue('timeSensitive', latest.text));
    if (urgent.length) {
      const due = deadlineIn(urgent.join(' '), latest.contact_date);
      if (due) {
        const d = daysBetween(today, due);
        if (d < 0) add(30, `Deadline passed ${-d} days ago (${due})`, urgent[0]);
        else if (d <= 14) add(30, `Deadline in ${d} day${d === 1 ? '' : 's'} (${due})`, urgent[0]);
        else add(15, `Deadline ${due}`, urgent[0]);
      } else add(20, 'Time-sensitive item', urgent[0]);
    }
    const grad = safe(findCue('graduationRisk', latest.text));
    if (grad.length && student.class_year === 'Senior') add(10, 'Senior with graduation blocker', grad[0]);
  }

  const score = reasons.reduce((s, r) => s + r.points, 0);
  reasons.sort((a, b) => b.points - a.points);

  return {
    lastContact,
    daysSince,
    lastContactType: latest?.contact_type || null,
    cadence,
    checkInDue: daysSince == null || daysSince > cadence,
    priority: { score, reasons },
  };
}

/** Pre-call briefing: the things an advisor should know in 20 seconds. */
export function briefing(student, notes) {
  const preferences = [];
  for (const n of notes)
    for (const s of safe(findCue('contactPreference', n.text)))
      preferences.push({ text: s, date: n.contact_date, noteId: n.id });

  // Recent notes that left something open, shown whole (minus any sensitive
  // sentences) so "No reply yet." keeps the context of what was asked.
  const openItems = [];
  for (const n of notes.slice(0, 3)) {
    if (!safe(findCue('openItem', n.text)).length) continue;
    openItems.push({ text: safe(sentences(n.text)).join(' '), date: n.contact_date, noteId: n.id });
  }

  const recentTypes = notes.slice(0, 5).map((n) => n.contact_type);
  const unanswered = notes.slice(0, 3).filter((n) => findCue('awaitingReply', n.text).length);
  let channelHint = null;
  if (preferences.some((p) => /phone/i.test(p.text))) channelHint = 'Phone — student asked not to be emailed';
  else if (unanswered.length && unanswered.every((n) => n.contact_type === 'Email'))
    channelHint = 'Emails have gone unanswered — try phone or in person';
  else if (unanswered.length) channelHint = 'Recent outreach unanswered — try a different channel';

  return {
    preferences,
    openItems,
    channelHint,
    sensitiveCount: notes.filter((n) => n.sensitive).length,
    recentTypes,
  };
}
