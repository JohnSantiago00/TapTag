import { MongoClient } from 'mongodb';

let client;
let db;

export function getMongoConfig() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'taptag';

  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  return { uri, dbName };
}

export async function getDb() {
  if (db) {
    return db;
  }

  const { uri, dbName } = getMongoConfig();
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000),
    tls: true,
  });
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}

export async function ensureIndexes(database = db) {
  if (!database) {
    database = await getDb();
  }

  await Promise.all([
    database.collection('cards').createIndex({ id: 1 }, { unique: true }),
    database.collection('brands').createIndex({ id: 1 }, { unique: true }),
    database.collection('mcc_map').createIndex({ mcc: 1 }, { unique: true }),
    database.collection('users').createIndex({ uid: 1 }, { unique: true }),
    database.collection('wallet').createIndex({ uid: 1, cardProductId: 1 }, { unique: true }),
    database.collection('events').createIndex({ uid: 1, occurredAt: -1 }),
  ]);
}
