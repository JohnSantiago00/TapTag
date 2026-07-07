#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const envPath = path.join(appRoot, '.env');
const envExamplePath = path.join(appRoot, '.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const requiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_TAPTAG_API_BASE_URL',
];

function logStatus(ok, label, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('🔎 TapTag local setup check');
console.log(`📁 App root: ${appRoot}`);
console.log(`🟢 Node: ${process.versions.node}`);

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (Number.isFinite(nodeMajor) && nodeMajor < 20) {
  logStatus(false, 'Node version looks old', 'Expo SDK 54 is happiest on Node 20+');
} else {
  logStatus(true, 'Node version looks usable');
}

const hasEnv = fs.existsSync(envPath);
logStatus(hasEnv, '.env file present', hasEnv ? envPath : `copy ${path.basename(envExamplePath)} to .env`);

const missingVars = requiredEnvVars.filter((name) => !process.env[name]);
logStatus(missingVars.length === 0, 'Required Firebase env vars', missingVars.length ? missingVars.join(', ') : 'all present');

console.log('ℹ️ MongoDB credentials live in backend/.env and are never bundled into the Expo app.');

const packageLockPath = path.join(appRoot, 'package-lock.json');
logStatus(fs.existsSync(packageLockPath), 'package-lock.json present', 'use npm install');

if (missingVars.length > 0 || !hasEnv) {
  console.log('\nNext steps:');
  console.log('1. cp .env.example .env');
  console.log('2. Fill in your Firebase project values');
  console.log('3. Run npm run first-run from the repo root');
  process.exit(1);
}

console.log('\nNext steps:');
console.log('1. Run npm run seed:knowledge --prefix backend to seed MongoDB');
console.log('2. Run npm run api to start the backend');
console.log('3. Run npm start (or npm run start:tunnel if networking is flaky)');
