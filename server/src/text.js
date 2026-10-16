// Text heuristics over free-text advising notes. Deliberately simple and
// transparent: every flag the UI shows can be traced back to a sentence.

const SSN = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g;

/** Strip SSNs from note text. Returns the cleaned text and what was removed. */
export function redactPII(text) {
  const found = [];
  const cleaned = text.replace(SSN, (m) => {
    // A bare 9-digit run could be a phone fragment or course code; only treat
    // it as an SSN if it is formatted like one or the word SSN is nearby.
    if (!/[- ]/.test(m) && !/\b(ssn|social security)\b/i.test(text)) return m;
    found.push('SSN');
    return '[SSN REDACTED]';
  });
  return { text: cleaned, redactions: found };
}

// Health / counselling / disability disclosures, or an explicit privacy request.
const SENSITIVE =
  /\b(counsel(?:or|ing|ling)|anxiety|depress\w*|therap(?:y|ist)|mental health|suicid\w*|self[- ]harm|disabilit\w*|accommodation|diagnos\w*|medical leave|pregnan\w*|assault|stay private|keep (?:this|it) private|confidential)\b/i;

export function looksSensitive(text) {
  return SENSITIVE.test(text);
}

export function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const CUES = {
  contactPreference:
    /\b(by (phone|text|email) only|(phone|text|email) only|best reached|prefers? (to be )?(contacted|reached)|do not (email|call)|shared family account)\b/i,
  awaitingReply:
    /\b(no (response|reply)( yet)?|awaiting (a )?reply|left (a )?voicemail|to reply with)\b/i,
  timeSensitive:
    /\b(deadline|by (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}|mid-(january|february|march|april|may|june|july|august|september|october|november|december)|probation|academic warning|withdraw\w*)\b/i,
  graduationRisk:
    /\b(not graduating|at risk of not graduating|to graduate|graduation audit|behind on (credits|capstone|the))\b/i,
  openItem:
    /\b(referred|plan:?|follow up|considering|needs?|asked about|awaiting|pending|retak\w+|switch\w*|worried|struggl\w+|missing|behind|overwhelmed|dropped|did not pass|no response|no reply)\b/i,
};

/** Return the sentences in `text` that match a given cue. */
export function findCue(cue, text) {
  return sentences(text).filter((s) => CUES[cue].test(s));
}
