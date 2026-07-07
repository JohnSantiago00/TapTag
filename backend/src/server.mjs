import dotenv from 'dotenv';
import path from 'path';
import { createTapTagApp } from './app.mjs';
import { requireFirebaseUser } from './firebaseAuth.mjs';
import { ensureIndexes, getDb } from './mongo.mjs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../frontend/.env') });

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

await ensureIndexes();

const app = createTapTagApp({
  getDb,
  requireFirebaseUser,
  allowedOrigins,
});

app.listen(port, host, () => {
  console.log(`TapTag API listening on http://${host}:${port}`);
});
