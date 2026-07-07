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

const requiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_TAPTAG_API_BASE_URL',
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

function ensureEnvFile() {
  if (fs.existsSync(envPath)) {
    console.log(`Using existing ${envPath}`);
    return;
  }

  if (!fs.existsSync(envExamplePath)) {
    throw new Error(`Missing template file: ${envExamplePath}`);
  }

  fs.copyFileSync(envExamplePath, envPath);
  console.log(`Created ${envPath} from .env.example`);
}

function loadEnv() {
  dotenv.config({ path: envPath });
}

function getMissingEnvVars() {
  return requiredEnvVars.filter((name) => !process.env[name]);
}

async function main() {
  console.log('TapTag first-run helper');
  console.log(`Repo root: ${repoRoot}`);

  ensureEnvFile();
  loadEnv();

  console.log('\nRunning setup check...');
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'doctor'], {
    cwd: repoRoot,
  });

  const missingEnvVars = getMissingEnvVars();
  if (missingEnvVars.length > 0) {
    console.log('\nYour frontend .env is not ready yet. Fill in these values first:');
    missingEnvVars.forEach((name) => console.log(`- ${name}`));
    console.log('\nThen rerun: npm run first-run');
    process.exit(1);
  }

  console.log('\nSeeding MongoDB knowledge data...');
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'seed:knowledge'], {
    cwd: path.join(repoRoot, 'backend'),
  });

  console.log('\nTapTag first-run completed.');
  console.log('Next steps:');
  console.log('1. npm run api');
  console.log('2. npm start');
}

main().catch((error) => {
  console.error(`\nFirst-run failed: ${error.message}`);
  process.exit(1);
});
