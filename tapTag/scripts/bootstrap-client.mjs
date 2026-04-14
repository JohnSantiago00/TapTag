#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'bootstrap'],
  {
    cwd: appRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      TAPTAG_FORCE_CLIENT_FIREBASE: '1',
      GOOGLE_APPLICATION_CREDENTIALS: '',
    },
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
