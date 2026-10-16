// Delete the local database so the next start re-imports the CSVs.
import fs from 'node:fs';
import { DB_PATH } from './config.js';

fs.rmSync(DB_PATH, { force: true });
console.log(`Removed ${DB_PATH}. It will be rebuilt from the CSVs on next start.`);
