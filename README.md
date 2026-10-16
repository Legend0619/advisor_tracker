# Advisor Tracker

An internal tool for advisors: see who needs outreach, open a student's history, and log a contact.

## How to run

Requires **Node 22.13+** (uses Node's built-in SQLite, so there's nothing native to install). Tested on Node 24, Windows 11.

```bash
npm install
npm start          # builds the UI and serves the app at http://localhost:3001
npm run dev        # development: API on :3001, UI with hot reload on :5173
npm test           # 6 API and data-cleaning tests
npm run reset-db   # rebuild the database from the CSVs on next start
```

"Today" is fixed at 2026-10-05, as the brief asks. Override it with `TODAY=yyyy-mm-dd`.

## Who it's for

Three advisors (Okafor, Reyes, Lindqvist) with about 17 students each. I assumed they are busy and not technical, work from spreadsheets and email today, and will only trust a recommendation they can see the reasoning behind. So the app opens on **"Who to contact next"**, and an "I am" picker narrows every view to one advisor's students.

## What it does

- **Students:** search, filter (advisor, risk, year, major, time since last contact) and sort.
- **Student page:** profile, contact history, and a form to log a contact with an optional follow-up date.
- **Smart feature:**
  - **Ranked outreach list.** Every point has a visible reason, e.g. "+35: 125 days since last contact (High risk: check in every 30 days)". It uses time since contact, the risk flag, GPA, unanswered outreach, deadlines in notes ("by Oct 15") and graduation blockers.
  - **Briefing before each contact.** It shows the contact preference (e.g. "phone only; email goes to a shared family account"), recent unresolved notes, and a warning when sensitive notes exist.
- **Data issues page:** what the importer found and what it did about each item.

## What I found in the data, and what I decided

| Found | Decision |
|---|---|
| The dataset README says dates are `YYYY-MM-DD`, but the files use 6 formats | Convert all dates to `YYYY-MM-DD` on import |
| 3 students with no contact. One is blank, one is `N/A` instead of blank, and S1018 is High risk | Treat them as never contacted, which raises their priority |
| Note N041 contains an SSN and a mental-health disclosure the student asked to keep private | Remove the SSN on import and from every new note. Hide the note until clicked and keep it out of the briefing. |
| Grace (S1021) and Gracie (S1050) Okonkwo look like one student with two advisors | Show a warning, but don't merge automatically |
| `last_contact_date` repeats what's in the notes | Work out last contact from the notes, so logging a note updates it |

## What I cut, and why

- **Login and permissions:** the "I am" picker stands in for login. Real use needs single sign-on and access rules for student privacy law (FERPA).
- **Editing or deleting notes:** notes can only be added, which is the safer default.
- **AI-written summaries:** these need a data agreement and redaction before student notes go to an outside AI service.
- **Merging duplicates, sending email, reminders, pagination:** each needs a policy decision, or isn't needed at 50 students.

## How I used AI

I did the design and decision-making. **Claude Code** (an AI coding agent in VS Code) did most of the implementation. I reviewed what it produced and walked through the app myself.

**What I did**
1. **Reviewed the requirements and the dataset** first: the mixed dates, missing contacts, the SSN and the likely duplicate.
2. **Defined the architecture:**
   - **Flow:** CSVs → SQLite → Express API → React. The CSVs are imported once in a single transaction and never written back to.
   - **Back end:** separate modules for importing, date and text handling, scoring, and routes. All business logic lives in the API; the UI only displays data and collects input.
   - **API:** six endpoints shaped around the screens: meta, outreach, the student list, one student, saving a note, and data issues. Invalid notes are rejected with an error for each field.
   - **Database:** `students`, append-only `notes` (with `sensitive` and `follow_up_date`), and `data_issues`. Last contact and the priority score are calculated when requested, so they are never out of date.
   - **Screens:** four — Outreach, Students, Student page (briefing, history and log form together), and Data issues. Filters are kept in the URL, so Back returns to the same view.
3. **Decided what to cut** (above).
4. **Chose the smart feature** and kept it **rule-based** rather than LLM-based. That way advisors can see why someone is ranked high, and no student notes leave the machine.

**What AI did:** wrote most of the code (importer, API, React screens) and the 6 tests from my design, and proposed the first scoring weights and check-in rhythm (30/45/90 days).

**What I reviewed, and what changed as a result**
- **A hard deadline was ranked too low.** A FAFSA deadline 10 days away ranked 18th. Deadlines in notes are now read as real dates, and the student ranks 8th.
- **The briefing showed fragments with no context**, such as "No reply yet.". It now shows the whole note.
- **Email was offered for a phone-only student.** The address is now crossed out with a warning.
- **The wording didn't match the dataset README.** The import messages and this README were brought into line with it.

**What still needs a human:** the weights and check-in rhythm are a first guess to confirm with advisors. Finding SSNs and sensitive notes relies on keyword matching, so advisors can also mark a note sensitive by hand.
