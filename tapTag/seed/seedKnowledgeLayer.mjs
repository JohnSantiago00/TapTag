// scripts/seedKnowledgeLayer.js
import dotenv from 'dotenv';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

dotenv.config();

// --- Firebase Admin Init ---
const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

// ------------------------------
// KNOWLEDGE LAYER SEED DATA
// ------------------------------

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
  { mcc: 5812, category: 'Dining - Restaurants', description: 'Full-service dining establishments', exampleBrands: ['Olive Garden', 'Applebee’s'] },
  { mcc: 5814, category: 'Dining - Coffee Shop', description: 'Cafes and coffeehouses', exampleBrands: ['Starbucks', 'Dunkin’'] },
  { mcc: 5411, category: 'Groceries', description: 'Supermarkets and grocery stores', exampleBrands: ['Whole Foods', 'Kroger'] },
  { mcc: 4112, category: 'Transportation', description: 'Passenger railways and commuter services', exampleBrands: ['Amtrak'] },
  { mcc: 5541, category: 'Gas Stations', description: 'Fuel and convenience services', exampleBrands: ['Shell', 'BP'] },
];

// Brands
const brands = [
  { id: 'starbucks', name: 'Starbucks', category: 'Coffee Shop', mcc: 5814, commonLocations: [{ lat: 40.7128, lon: -74.006, address: 'New York, NY' }] },
  { id: 'whole_foods', name: 'Whole Foods Market', category: 'Groceries', mcc: 5411, commonLocations: [{ lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' }] },
  { id: 'shell', name: 'Shell Gas Station', category: 'Gas Station', mcc: 5541, commonLocations: [{ lat: 29.7604, lon: -95.3698, address: 'Houston, TX' }] }
];

// ------------------------------
// FIRESTORE WRITE LOGIC
// ------------------------------

async function seedCollection(collectionName, dataList) {
  const batch = db.batch();
  dataList.forEach((data) => {
    const docRef = db.collection(collectionName).doc(data.id || String(data.mcc));
    batch.set(docRef, { ...data, lastUpdated: new Date().toISOString() });
  });
  await batch.commit();
  console.log(`✅ Seeded ${dataList.length} docs into '${collectionName}'`);
}

(async () => {
  try {
    console.log('🚀 Starting Firestore Knowledge Layer Seeding...');
    await seedCollection('cards', cards);
    await seedCollection('brands', brands);
    await seedCollection('mcc_map', mccMap);
    console.log('🎉 All data seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
})();