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
  validateCards(cards);
  validateBrands(brands);
  validateMccMap(mccMap);

  console.log('🔎 Knowledge layer schema audit passed');
}

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
    auditKnowledgeLayer();
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
