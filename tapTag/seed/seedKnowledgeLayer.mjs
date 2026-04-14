// seed/seedKnowledgeLayer.mjs
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cert, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { doc, getFirestore as getClientFirestore, writeBatch } from 'firebase/firestore';

/*
  File role:
  Seeds the global knowledge layer used by Wallet, Lab, and Nearby.

  This script is intentionally separate from the app runtime because seeding is
  an environment/setup concern, not a user-facing feature.
*/

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Prefer Admin credentials when present, but allow local development to keep
// moving with client-SDK writes if serviceAccountKey.json is missing.
function resolveCredentialPath() {
  const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawPath) return null;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(repoRoot, rawPath);
}

function createFirestoreWriter() {
  const credentialPath = resolveCredentialPath();
  const forceClientMode = process.env.TAPTAG_FORCE_CLIENT_FIREBASE === '1';

  if (!forceClientMode && credentialPath && fs.existsSync(credentialPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    const app = initializeAdminApp({ credential: cert(serviceAccount) });
    const db = getAdminFirestore(app);

    console.log(`🔐 Using Firebase Admin credentials from ${credentialPath}`);

    return {
      mode: 'admin',
      async seedCollection(collectionName, dataList) {
        // Batch writes keep seeding fast and reduce the chance of partial writes
        // when multiple docs belong to the same logical dataset.
        const batch = db.batch();
        dataList.forEach((data) => {
          const docRef = db.collection(collectionName).doc(data.id || String(data.mcc));
          batch.set(docRef, { ...data, lastUpdated: new Date().toISOString() });
        });
        await batch.commit();
        console.log(`✅ Seeded ${dataList.length} docs into '${collectionName}'`);
      }
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

  const app = initializeClientApp(firebaseConfig, 'seed-client-fallback');
  const db = getClientFirestore(app);

  if (forceClientMode) {
    console.log('⚠️ TAPTAG_FORCE_CLIENT_FIREBASE=1 set. Skipping Firebase Admin credentials and using client-SDK Firestore writes.');
  } else {
    console.log('⚠️ Firebase Admin key not found. Falling back to client-SDK Firestore writes using .env config.');
  }
  console.log('⚠️ This requires Firestore rules to allow these writes from your local environment.');

  return {
    mode: 'client',
    async seedCollection(collectionName, dataList) {
      // Same batching idea as admin mode, just using the client SDK API.
      const batch = writeBatch(db);
      dataList.forEach((data) => {
        const docRef = doc(db, collectionName, data.id || String(data.mcc));
        batch.set(docRef, { ...data, lastUpdated: new Date().toISOString() });
      });
      await batch.commit();
      console.log(`✅ Seeded ${dataList.length} docs into '${collectionName}'`);
    }
  };
}

const firestoreWriter = createFirestoreWriter();

// Keeping normalized categories constrained protects the thin-slice
// recommendation engine from drift in seed data.
const ALLOWED_NORMALIZED_CATEGORIES = [
  'Dining',
  'Groceries',
  'Gas',
  'Travel',
  'Transportation',
  'Entertainment',
  'Online Shopping',
  'Other'
];

// ------------------------------
// KNOWLEDGE LAYER SEED DATA
// ------------------------------

// These arrays are the canonical thin-slice seed dataset for the current app.
// They are intentionally small so the whole recommendation loop stays readable.

// Global Cards
const cards = [
  {
    id: 'amex_gold',
    name: 'American Express Gold Card',
    issuer: 'American Express',
    network: 'Amex',
    rewardRules: [
      { category: 'Dining', rate: 4 },
      { category: 'Groceries', rate: 4 },
      { category: 'Travel', rate: 3 },
      { category: 'Other', rate: 1 }
    ],
    annualFee: 250,
    issuerWebsite: 'https://www.americanexpress.com/us/credit-cards/card/gold-card/'
  },
  {
    id: 'chase_sapphire_preferred',
    name: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    network: 'Visa',
    rewardRules: [
      { category: 'Travel', rate: 2 },
      { category: 'Dining', rate: 3 },
      { category: 'Online Grocery', rate: 1 },
      { category: 'Other', rate: 1 }
    ],
    annualFee: 95,
    issuerWebsite: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred'
  },
  {
    id: 'citi_custom_cash',
    name: 'Citi Custom Cash Card',
    issuer: 'Citi',
    network: 'Mastercard',
    rewardRules: [
      { category: 'Top Monthly Spend Category', rate: 5 },
      { category: 'Other', rate: 1 }
    ],
    annualFee: 0,
    issuerWebsite: 'https://www.citi.com/credit-cards/citi-custom-cash-credit-card'
  }
];

// MCC Map
const mccMap = [
  { mcc: 5812, category: 'Dining - Restaurants', normalizedCategory: 'Dining', description: 'Full-service dining establishments', exampleBrands: ['Olive Garden', 'Applebee’s'] },
  { mcc: 5814, category: 'Dining - Coffee Shop', normalizedCategory: 'Dining', description: 'Cafes and coffeehouses', exampleBrands: ['Starbucks', 'Dunkin’'] },
  { mcc: 5311, category: 'Online Shopping', normalizedCategory: 'Online Shopping', description: 'Online marketplaces and e-commerce merchants', exampleBrands: ['Amazon'] },
  { mcc: 5411, category: 'Groceries', normalizedCategory: 'Groceries', description: 'Supermarkets and grocery stores', exampleBrands: ['Whole Foods', 'Kroger'] },
  { mcc: 4112, category: 'Transportation', normalizedCategory: 'Transportation', description: 'Passenger railways and commuter services', exampleBrands: ['Amtrak'] },
  { mcc: 5541, category: 'Gas Stations', normalizedCategory: 'Gas', description: 'Fuel and convenience services', exampleBrands: ['Shell', 'BP'] },
];

// Brands
const brands = [
  { id: 'amazon', name: 'Amazon', category: 'Online Shopping', mcc: 5311, brandLogo: 'https://logo.clearbit.com/amazon.com', commonLocations: [] },
  { id: 'starbucks', name: 'Starbucks', category: 'Coffee Shop', mcc: 5814, commonLocations: [{ lat: 40.7128, lon: -74.006, address: 'New York, NY' }] },
  { id: 'whole_foods', name: 'Whole Foods Market', category: 'Groceries', mcc: 5411, commonLocations: [{ lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' }] },
  { id: 'shell', name: 'Shell Gas Station', category: 'Gas Station', mcc: 5541, commonLocations: [{ lat: 29.7604, lon: -95.3698, address: 'Houston, TX' }] }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// These validators make seed problems fail fast before bad docs reach Firestore.
function validateCards(cardsToValidate) {
  cardsToValidate.forEach((card) => {
    assert(card.id, `Card is missing id: ${JSON.stringify(card)}`);
    assert(card.name, `Card ${card.id} is missing name`);
    assert(Array.isArray(card.rewardRules), `Card ${card.id} is missing rewardRules array`);
    assert(card.rewardRules.length > 0, `Card ${card.id} must include at least one reward rule`);

    card.rewardRules.forEach((rule, index) => {
      assert(rule.category, `Card ${card.id} rewardRules[${index}] is missing category`);
      assert(Number.isFinite(Number(rule.rate)), `Card ${card.id} rewardRules[${index}] has invalid rate`);
    });
  });
}

function validateBrands(brandsToValidate) {
  brandsToValidate.forEach((brand) => {
    assert(brand.id, `Brand is missing id: ${JSON.stringify(brand)}`);
    assert(Array.isArray(brand.commonLocations), `Brand ${brand.id} must use commonLocations array`);

    brand.commonLocations.forEach((location, index) => {
      assert(Number.isFinite(Number(location.lat)), `Brand ${brand.id} commonLocations[${index}] has invalid lat`);
      assert(Number.isFinite(Number(location.lon)), `Brand ${brand.id} commonLocations[${index}] has invalid lon`);
    });
  });
}

function validateMccMap(mccMappingsToValidate) {
  mccMappingsToValidate.forEach((mapping) => {
    assert(Number.isFinite(Number(mapping.mcc)), `MCC mapping has invalid mcc: ${JSON.stringify(mapping)}`);
    assert(mapping.category, `MCC ${mapping.mcc} is missing category`);
    assert(mapping.normalizedCategory, `MCC ${mapping.mcc} is missing normalizedCategory`);
    assert(
      ALLOWED_NORMALIZED_CATEGORIES.includes(mapping.normalizedCategory),
      `MCC ${mapping.mcc} has unsupported normalizedCategory: ${mapping.normalizedCategory}`
    );
  });
}

function auditKnowledgeLayer() {
  // Audit all datasets before any write begins so we fail fast and do not leave
  // Firestore partially updated with inconsistent seed shapes.
  validateCards(cards);
  validateBrands(brands);
  validateMccMap(mccMap);

  console.log('🔎 Knowledge layer schema audit passed');
}

// ------------------------------
// FIRESTORE WRITE LOGIC
// ------------------------------

(async () => {
  try {
    console.log('🚀 Starting Firestore Knowledge Layer Seeding...');
    console.log(`🧰 Seeding mode: ${firestoreWriter.mode}`);
    auditKnowledgeLayer();
    await firestoreWriter.seedCollection('cards', cards);
    await firestoreWriter.seedCollection('brands', brands);
    await firestoreWriter.seedCollection('mcc_map', mccMap);
    console.log('🎉 All data seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
})();
