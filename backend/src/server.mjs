import dotenv from 'dotenv';
import path from 'path';
import { createTapTagApp } from './app.mjs';
import { requireFirebaseUser } from './firebaseAuth.mjs';
import { createGooglePlacesClient } from './googlePlaces.mjs';
import { closeDb, ensureIndexes, getDb } from './mongo.mjs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../frontend/.env') });

const isProduction = process.env.NODE_ENV === 'production';

const missing = [];
if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
if (!process.env.FIREBASE_PROJECT_ID && !process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) {
  missing.push('FIREBASE_PROJECT_ID');
}
if (missing.length) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy backend/.env.example to backend/.env and fill in the values.'
  );
  process.exit(1);
}

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.includes('*')) {
  console.warn(
    'CORS_ORIGIN is "*" in production. Set it to your app origins to restrict browser access.'
  );
}

await ensureIndexes();

const app = createTapTagApp({
  getDb,
  requireFirebaseUser,
  placesClient: createGooglePlacesClient({ apiKey: process.env.GOOGLE_PLACES_API_KEY }),
  allowedOrigins,
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
  },
  trustProxy: process.env.TRUST_PROXY === 'true' ? 1 : false,
});

const server = app.listen(port, host, () => {
  console.log(`TapTag API listening on http://${host}:${port}`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error('Shutdown timed out, exiting.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      console.error('Error closing HTTP server:', error);
    }
    try {
      await closeDb();
    } catch (dbError) {
      console.error('Error closing MongoDB connection:', dbError);
    }
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
