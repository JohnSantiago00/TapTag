#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const envExamplePath = path.join(backendRoot, '.env.example');
const envPath = path.join(backendRoot, '.env');

if (!fs.existsSync(envExamplePath)) {
  console.error(`Missing template: ${envExamplePath}`);
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log(`Backend .env already exists at ${envPath}`);
} else {
  fs.copyFileSync(envExamplePath, envPath);
  console.log(`Created ${envPath} from .env.example`);
}

console.log('\nNext steps:');
console.log('1. Fill in backend/.env with MONGODB_URI, FIREBASE_PROJECT_ID, and GOOGLE_PLACES_API_KEY');
console.log('2. Run npm run seed:knowledge --prefix backend');
console.log('3. Run npm run api from the repo root');
