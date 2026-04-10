import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cert, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { doc, getFirestore as getClientFirestore, writeBatch } from 'firebase/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOCS_TO_DELETE = {
  cards: ['chase-freedom'],
  brands: ['target'],
  mcc_map: ['5310'],
};

function resolveCredentialPath() {
  const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawPath) return null;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(repoRoot, rawPath);
}

function createFirestoreCleaner() {
  const credentialPath = resolveCredentialPath();

  if (credentialPath && fs.existsSync(credentialPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    const app = initializeAdminApp({ credential: cert(serviceAccount) });
    const db = getAdminFirestore(app);

    console.log(`🔐 Using Firebase Admin credentials from ${credentialPath}`);

    return {
      mode: 'admin',
      async deleteDocs(collectionName, ids) {
        if (!ids.length) return;

        const batch = db.batch();
        ids.forEach((id) => {
          const ref = db.collection(collectionName).doc(id);
          batch.delete(ref);
        });

        await batch.commit();
        console.log(`🧹 Deleted ${ids.length} docs from '${collectionName}': ${ids.join(', ')}`);
      },
    };
  }

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  const requiredFirebaseConfig = Object.fromEntries(
    Object.entries(firebaseConfig).filter(([key]) => key !== 'measurementId')
  );

  const missingConfig = Object.entries(requiredFirebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingConfig.length) {
    throw new Error(
      `No Firebase Admin credential file found, and client Firebase config is incomplete. Missing: ${missingConfig.join(', ')}`
    );
  }

  const app = initializeClientApp(firebaseConfig, 'cleanup-client-fallback');
  const db = getClientFirestore(app);

  console.log('⚠️ Firebase Admin key not found. Falling back to client-SDK Firestore deletes using .env config.');
  console.log('⚠️ This requires Firestore rules to allow these deletes from your local environment.');

  return {
    mode: 'client',
    async deleteDocs(collectionName, ids) {
      if (!ids.length) return;

      const batch = writeBatch(db);
      ids.forEach((id) => {
        const ref = doc(db, collectionName, id);
        batch.delete(ref);
      });

      await batch.commit();
      console.log(`🧹 Deleted ${ids.length} docs from '${collectionName}': ${ids.join(', ')}`);
    },
  };
}

const firestoreCleaner = createFirestoreCleaner();

(async () => {
  try {
    console.log('🚀 Starting knowledge-layer cleanup...');
    console.log(`🧰 Cleanup mode: ${firestoreCleaner.mode}`);

    for (const [collectionName, ids] of Object.entries(DOCS_TO_DELETE)) {
      await firestoreCleaner.deleteDocs(collectionName, ids);
    }

    console.log('✅ Cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
})();
