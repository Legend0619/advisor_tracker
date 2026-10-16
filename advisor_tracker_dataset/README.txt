ADVISOR OUTREACH TRACKER - SAMPLE DATA
=====================================

All data in these files is SYNTHETIC. Every student, email address, and note is
fictional (emails use the reserved example.edu domain). Any resemblance to real
people is coincidental.

FILES
-----
students.csv (50 rows)
  student_id          Unique ID
  first_name, last_name
  email               Fictional
  major               "Undeclared" and "Pre-Nursing" are valid values
  class_year          Freshman / Sophomore / Junior / Senior
  credits_earned      Total credits completed
  gpa                 Cumulative GPA (4.0 scale)
  advisor             Assigned advisor (last name)
  last_contact_date   Most recent outreach (YYYY-MM-DD). Blank = never contacted
  risk_flag           Low / Medium / High, as set by the advising office

contact_notes.csv (history of past outreach)
  note_id, student_id (matches students.csv), contact_date (YYYY-MM-DD),
  contact_type (Email / Phone / Zoom / In person), advisor, note_text

ASSUMPTIONS
-----------
- Treat "today" as October 5, 2026.
- Like real data, this set is imperfect. Not every student has been contacted.
  Decide how your tool should handle that.
- You are free to extend, reshape, or load this data into any storage you like.
