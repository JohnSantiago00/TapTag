#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const envExamplePath = path.join(appRoot, '.env.example');
const envPath = path.join(appRoot, '.env');

if (!fs.existsSync(envExamplePath)) {
  console.error(`❌ Missing template: ${envExamplePath}`);
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log(`ℹ️ .env already exists at ${envPath}`);
} else {
  fs.copyFileSync(envExamplePath, envPath);
  console.log(`✅ Created ${envPath} from .env.example`);
}

console.log('\nNext steps:');
console.log('1. Fill in tapTag/.env with your Firebase project values');
console.log('2. Run npm run doctor');
console.log('3. Run npm run bootstrap or npm run bootstrap:client');
console.log('4. Run npm start');
