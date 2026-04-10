import dotenv from 'dotenv';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

dotenv.config();

const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

const DOCS_TO_DELETE = {
  cards: ['chase-freedom'],
  brands: ['target'],
  mcc_map: ['5310'],
};

async function deleteDocs(collectionName, ids) {
  if (!ids.length) return;

  const batch = db.batch();

  ids.forEach((id) => {
    const ref = db.collection(collectionName).doc(id);
    batch.delete(ref);
  });

  await batch.commit();
  console.log(`🧹 Deleted ${ids.length} docs from '${collectionName}': ${ids.join(', ')}`);
}

(async () => {
  try {
    console.log('🚀 Starting knowledge-layer cleanup...');

    for (const [collectionName, ids] of Object.entries(DOCS_TO_DELETE)) {
      await deleteDocs(collectionName, ids);
    }

    console.log('✅ Cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
})();
