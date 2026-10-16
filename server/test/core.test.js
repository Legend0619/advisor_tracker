import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate } from '../src/dates.js';
import { redactPII, looksSensitive } from '../src/text.js';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

test('parseDate handles every format in the dataset', () => {
  assert.equal(parseDate('2026-09-18'), '2026-09-18');
  assert.equal(parseDate('Aug 25, 2026'), '2026-08-25');
  assert.equal(parseDate('2026/09/02'), '2026-09-02');
  assert.equal(parseDate('30-Aug-2026'), '2026-08-30');
  assert.equal(parseDate('09/16/2026'), '2026-09-16');
  assert.equal(parseDate('10-Sep-2026'), '2026-09-10');
  assert.equal(parseDate(''), null);
  assert.equal(parseDate('N/A'), null);
  assert.equal(parseDate('2026-02-31'), null);
});

test('redactPII removes SSNs but leaves other numbers', () => {
  const r = redactPII('she gave her SSN 000-12-3456 so I could fill it out. Needs 12 credits.');
  assert.match(r.text, /\[SSN REDACTED\]/);
  assert.doesNotMatch(r.text, /3456/);
  assert.deepEqual(r.redactions, ['SSN']);
  assert.equal(redactPII('Plans to take CSC 460 in 2026.').redactions.length, 0);
});

test('looksSensitive flags counselling disclosures', () => {
  assert.ok(looksSensitive('has been seeing a campus counselor for anxiety'));
  assert.ok(!looksSensitive('Referred to tutoring center.'));
});

async function withServer(fn) {
  const db = openDb(':memory:');
  const server = createApp(db, '2026-10-05').listen(0);
  const base = `http://localhost:${server.address().port}/api`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('import cleans the dataset and records issues', () =>
  withServer(async (base) => {
    const students = await (await fetch(`${base}/students`)).json();
    assert.equal(students.length, 50);
    const tomas = students.find((s) => s.id === 'S1006');
    assert.equal(tomas.lastContact, null);
    assert.equal(tomas.priority.reasons[0].label, 'Never contacted');

    const sofia = students.find((s) => s.id === 'S1003');
    assert.equal(sofia.lastContact, '2026-08-25');

    const issues = await (await fetch(`${base}/data-issues`)).json();
    const kinds = new Set(issues.map((i) => i.kind));
    for (const k of ['pii_redacted', 'possible_duplicate', 'no_contact_date', 'date_format', 'sensitive_note'])
      assert.ok(kinds.has(k), `expected issue kind ${k}`);

    const camila = await (await fetch(`${base}/students/S1037`)).json();
    const n041 = camila.notes.find((n) => n.id === 'N041');
    assert.ok(n041.sensitive);
    assert.doesNotMatch(n041.text, /000-12-3456/);
    // Briefing must not leak the sensitive sentence.
    assert.ok(!camila.briefing.openItems.some((o) => /anxiety|counselor/i.test(o.text)));
  }));

test('outreach ranks never-contacted high-risk student near the top', () =>
  withServer(async (base) => {
    const list = await (await fetch(`${base}/outreach`)).json();
    const top = list.slice(0, 8).map((s) => s.id);
    assert.ok(top.includes('S1018'), `S1018 not in top 8: ${top}`);
  }));

test('logging a note validates, redacts, and updates last contact', () =>
  withServer(async (base) => {
    const post = (body) =>
      fetch(`${base}/students/S1006/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    const bad = await post({ contact_date: '2026-12-01', contact_type: 'Fax', advisor: 'Nobody', text: '' });
    assert.equal(bad.status, 422);
    const { fields } = await bad.json();
    assert.ok(fields.contact_date && fields.contact_type && fields.advisor && fields.text);

    const ok = await post({
      contact_date: '2026-10-05',
      contact_type: 'Phone',
      advisor: 'Lindqvist',
      text: 'Intro call. SSN 123-45-6789 mentioned. Exploring majors.',
      follow_up_date: '2026-10-12',
    });
    assert.equal(ok.status, 201);
    const body = await ok.json();
    assert.deepEqual(body.redactions, ['SSN']);

    const s = await (await fetch(`${base}/students/S1006`)).json();
    assert.equal(s.lastContact, '2026-10-05');
    assert.equal(s.daysSince, 0);
    assert.doesNotMatch(s.notes[0].text, /6789/);
    assert.equal(s.notes[0].follow_up_date, '2026-10-12');
  }));
