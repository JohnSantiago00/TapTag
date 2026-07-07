import dotenv from 'dotenv';
import { closeDb, getDb } from '../src/mongo.mjs';

dotenv.config();

const DOCS_TO_DELETE = {
  cards: { field: 'id', ids: ['chase-freedom'] },
  brands: { field: 'id', ids: ['target'] },
  mcc_map: { field: 'mcc', ids: [5310] },
};

try {
  console.log('Starting MongoDB knowledge-layer cleanup...');
  const db = await getDb();

  for (const [collectionName, target] of Object.entries(DOCS_TO_DELETE)) {
    if (!target.ids.length) continue;

    const result = await db.collection(collectionName).deleteMany({
      [target.field]: { $in: target.ids },
    });

    console.log(
      `Deleted ${result.deletedCount} docs from ${collectionName}: ${target.ids.join(', ')}`
    );
  }

  console.log('Cleanup complete');
  await closeDb();
  process.exit(0);
} catch (error) {
  console.error('Cleanup failed:', error);
  if (String(error?.message || '').includes('tlsv1 alert internal error')) {
    console.error(
      'MongoDB Atlas rejected the TLS connection before cleanup. Check Atlas Network Access/IP allowlist for this machine and confirm the cluster is active.'
    );
  }
  await closeDb().catch(() => {});
  process.exit(1);
}
