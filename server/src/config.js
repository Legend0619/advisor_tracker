import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The brief says to treat "today" as 2026-10-05. Override with TODAY=yyyy-mm-dd,
// or TODAY=real to use the system clock.
export const TODAY =
  process.env.TODAY === 'real'
    ? new Date().toISOString().slice(0, 10)
    : process.env.TODAY || '2026-10-05';

export const PORT = Number(process.env.PORT || 3001);

export const DATASET_DIR =
  process.env.DATASET_DIR || path.resolve(here, '../../advisor_tracker_dataset');

export const DB_PATH =
  process.env.DB_PATH || path.resolve(here, '../data/advisor.db');

export const CLIENT_DIST = path.resolve(here, '../../client/dist');

export const CONTACT_TYPES = ['In person', 'Phone', 'Email', 'Zoom'];

// How often each risk tier should hear from their advisor. These are my
// assumptions, not office policy — first thing to confirm with advisors.
export const CHECK_IN_DAYS = { High: 30, Medium: 45, Low: 90 };
