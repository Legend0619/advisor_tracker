import { PORT, TODAY, DB_PATH } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';

const db = openDb();
createApp(db).listen(PORT, () => {
  console.log(`Advisor Tracker API on http://localhost:${PORT}  (today = ${TODAY}, db = ${DB_PATH})`);
});
