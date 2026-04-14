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
];

function logStatus(ok, label, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? `: ${detail}` : ''}`);
}

function resolveCredentialPath() {
  const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawPath) return null;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(appRoot, rawPath);
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

const credentialPath = resolveCredentialPath();
const hasCredentialFile = Boolean(credentialPath && fs.existsSync(credentialPath));

if (!credentialPath) {
  console.log('⚠️ No GOOGLE_APPLICATION_CREDENTIALS set. Seed scripts can still use client SDK fallback if Firestore rules allow it.');
} else if (hasCredentialFile) {
  logStatus(true, 'Firebase admin credential file found', credentialPath);
} else {
  logStatus(false, 'Firebase admin credential path is set but file is missing', credentialPath);
}

const packageLockPath = path.join(appRoot, 'package-lock.json');
logStatus(fs.existsSync(packageLockPath), 'package-lock.json present', 'use npm install');

if (missingVars.length > 0 || !hasEnv) {
  console.log('\nNext steps:');
  console.log('1. cp .env.example .env');
  console.log('2. Fill in your Firebase project values');
  console.log('3. Run npm run bootstrap');
  process.exit(1);
}

console.log('\nNext steps:');
if (hasCredentialFile) {
  console.log('1. Run npm run bootstrap to seed the knowledge layer');
} else {
  console.log('1. Deploy Firestore rules if needed, then run npm run bootstrap:client');
}
console.log('2. Run npm start (or npm run start:tunnel if networking is flaky)');
