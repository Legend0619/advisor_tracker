// The source CSVs mix at least six date formats. Everything is normalised to
// ISO yyyy-mm-dd on import so the rest of the app only ever sees one format.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n) => String(n).padStart(2, '0');

function build(y, m, d) {
  y = Number(y); m = Number(m); d = Number(d);
  if (!m || m > 12 || !d || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates like 2026-02-31 (Date would roll them over).
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parse a messy date string. Returns ISO yyyy-mm-dd, or null when the value is
 * blank / "N/A" / unparseable.
 */
export function parseDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || /^(n\/?a|none|null|-)$/i.test(s)) return null;

  let m;
  // 2026-09-18 or 2026/09/18
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) return build(m[1], m[2], m[3]);
  // 09/16/2026 — US month/day/year (the only slash-first format in the data)
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return build(m[3], m[1], m[2]);
  // Aug 25, 2026
  if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/))) {
    const mon = MONTHS[m[1].toLowerCase()];
    return mon ? build(m[3], mon, m[2]) : null;
  }
  // 30-Aug-2026
  if ((m = s.match(/^(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{4})$/))) {
    const mon = MONTHS[m[2].toLowerCase()];
    return mon ? build(m[3], mon, m[1]) : null;
  }
  return null;
}

export function isIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && parseDate(s) === s;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export function addDays(iso, n) {
  const d = new Date(Date.parse(iso) + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
