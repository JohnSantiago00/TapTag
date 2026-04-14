#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const envExamplePath = path.join(appRoot, '.env.example');
const envPath = path.join(appRoot, '.env');
const firebaseJsonPath = path.join(repoRoot, 'firebase.json');

const requiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: 'inherit',
      env: options.env ?? process.env,
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with code ${code ?? 'unknown'}`));
      }
    });

    child.on('error', reject);
  });
}

function hasCommand(command) {
  return new Promise((resolve) => {
    const probe = spawn(command, ['--version'], { stdio: 'ignore' });
    probe.on('exit', (code) => resolve(code === 0));
    probe.on('error', () => resolve(false));
  });
}

function ensureEnvFile() {
  if (fs.existsSync(envPath)) {
    console.log(`ℹ️ Using existing ${envPath}`);
    return;
  }

  if (!fs.existsSync(envExamplePath)) {
    throw new Error(`Missing template file: ${envExamplePath}`);
  }

  fs.copyFileSync(envExamplePath, envPath);
  console.log(`✅ Created ${envPath} from .env.example`);
}

function loadEnv() {
  dotenv.config({ path: envPath });
}

function getMissingEnvVars() {
  return requiredEnvVars.filter((name) => !process.env[name]);
}

async function main() {
  console.log('🚀 TapTag first-run helper');
  console.log(`📁 Repo root: ${repoRoot}`);

  ensureEnvFile();
  loadEnv();

  console.log('\n🩺 Running setup check...');
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'doctor'], {
    cwd: repoRoot,
  });

  const missingEnvVars = getMissingEnvVars();
  if (missingEnvVars.length > 0) {
    console.log('\n❌ Your .env is not ready yet. Fill in these values first:');
    missingEnvVars.forEach((name) => console.log(`- ${name}`));
    console.log('\nThen rerun: npm run first-run');
    process.exit(1);
  }

  const firebaseCliInstalled = await hasCommand('firebase');
  const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!fs.existsSync(firebaseJsonPath)) {
    throw new Error(`Missing firebase.json at ${firebaseJsonPath}`);
  }

  if (!firebaseCliInstalled) {
    console.log('\n⚠️ Firebase CLI is not installed, so I cannot deploy Firestore rules automatically.');
    console.log('Install it with: npm install -g firebase-tools');
    console.log('Then run: firebase login');
    console.log('After that, rerun: npm run first-run');
    process.exit(1);
  }

  console.log(`\n☁️ Deploying Firestore rules and indexes to project ${firebaseProjectId}...`);
  await run('firebase', ['deploy', '--only', 'firestore:rules,firestore:indexes', '--project', firebaseProjectId], {
    cwd: repoRoot,
  });

  console.log('\n🌱 Bootstrapping seeded data with client Firebase config...');
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'bootstrap:client'], {
    cwd: repoRoot,
  });

  console.log('\n✅ TapTag first-run completed.');
  console.log('Next step: npm start');
}

main().catch((error) => {
  console.error(`\n❌ First-run failed: ${error.message}`);
  process.exit(1);
});
