import dotenv from 'dotenv';
import { closeDb, ensureIndexes, getDb } from '../src/mongo.mjs';

dotenv.config();

const ALLOWED_NORMALIZED_CATEGORIES = [
  'Dining',
  'Groceries',
  'Gas',
  'Travel',
  'Transportation',
  'Entertainment',
  'Online Shopping',
  'Other',
];

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
      { category: 'Other', rate: 1 },
    ],
    annualFee: 250,
    issuerWebsite: 'https://www.americanexpress.com/us/credit-cards/card/gold-card/',
  },
  {
    id: 'chase_sapphire_preferred',
    name: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    network: 'Visa',
    rewardRules: [
      { category: 'Travel', rate: 2 },
      { category: 'Dining', rate: 3 },
      { category: 'Online Shopping', rate: 1 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 95,
    issuerWebsite: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
  },
  {
    id: 'citi_custom_cash',
    name: 'Citi Custom Cash Card',
    issuer: 'Citi',
    network: 'Mastercard',
    rewardRules: [
      { category: 'Top Monthly Spend Category', rate: 5 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 0,
    issuerWebsite: 'https://www.citi.com/credit-cards/citi-custom-cash-credit-card',
  },
  {
    id: 'chase_freedom_flex',
    name: 'Chase Freedom Flex',
    issuer: 'Chase',
    network: 'Mastercard',
    rewardRules: [
      { category: 'Dining', rate: 3 },
      { category: 'Groceries', rate: 3 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 0,
    issuerWebsite: 'https://creditcards.chase.com/cash-back-credit-cards/freedom/flex',
  },
  {
    id: 'capital_one_savor',
    name: 'Capital One Savor Cash Rewards',
    issuer: 'Capital One',
    network: 'Mastercard',
    rewardRules: [
      { category: 'Dining', rate: 3 },
      { category: 'Entertainment', rate: 3 },
      { category: 'Groceries', rate: 3 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 0,
    issuerWebsite: 'https://www.capitalone.com/credit-cards/savor/',
  },
  {
    id: 'wells_fargo_autograph',
    name: 'Wells Fargo Autograph Card',
    issuer: 'Wells Fargo',
    network: 'Visa',
    rewardRules: [
      { category: 'Dining', rate: 3 },
      { category: 'Travel', rate: 3 },
      { category: 'Transportation', rate: 3 },
      { category: 'Gas', rate: 3 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 0,
    issuerWebsite: 'https://creditcards.wellsfargo.com/autograph-visa-credit-card/',
  },
  {
    id: 'blue_cash_preferred',
    name: 'Blue Cash Preferred Card',
    issuer: 'American Express',
    network: 'Amex',
    rewardRules: [
      { category: 'Groceries', rate: 6 },
      { category: 'Gas', rate: 3 },
      { category: 'Transportation', rate: 3 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 95,
    issuerWebsite: 'https://www.americanexpress.com/us/credit-cards/card/blue-cash-preferred/',
  },
  {
    id: 'prime_visa',
    name: 'Prime Visa',
    issuer: 'Chase',
    network: 'Visa',
    rewardRules: [
      { category: 'Online Shopping', rate: 5 },
      { category: 'Dining', rate: 2 },
      { category: 'Gas', rate: 2 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 0,
    issuerWebsite: 'https://www.amazon.com/Prime-Visa/dp/BT00LN946S',
  },
  {
    id: 'chase_freedom_unlimited',
    name: 'Chase Freedom Unlimited',
    issuer: 'Chase',
    network: 'Visa',
    rewardRules: [
      { category: 'Dining', rate: 3 },
      { category: 'Travel', rate: 5 },
      { category: 'Other', rate: 1.5 },
    ],
    annualFee: 0,
    issuerWebsite: 'https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited',
  },
  {
    id: 'capital_one_venture_x',
    name: 'Capital One Venture X',
    issuer: 'Capital One',
    network: 'Visa',
    rewardRules: [
      { category: 'Travel', rate: 5 },
      { category: 'Other', rate: 2 },
    ],
    annualFee: 395,
    issuerWebsite: 'https://www.capitalone.com/credit-cards/venture-x/',
  },
];

const mccMap = [
  { mcc: 5812, category: 'Dining - Restaurants', normalizedCategory: 'Dining', description: 'Full-service dining establishments', exampleBrands: ['Olive Garden', 'Applebee’s'] },
  { mcc: 5814, category: 'Dining - Coffee Shop', normalizedCategory: 'Dining', description: 'Cafes and coffeehouses', exampleBrands: ['Starbucks', 'Dunkin’'] },
  { mcc: 5311, category: 'Online Shopping', normalizedCategory: 'Online Shopping', description: 'Online marketplaces and e-commerce merchants', exampleBrands: ['Amazon'] },
  { mcc: 5411, category: 'Groceries', normalizedCategory: 'Groceries', description: 'Supermarkets and grocery stores', exampleBrands: ['Whole Foods', 'Kroger'] },
  { mcc: 5422, category: 'Groceries - Specialty Food', normalizedCategory: 'Groceries', description: 'Meat, seafood, and specialty food stores', exampleBrands: ['Local Market'] },
  { mcc: 4112, category: 'Transportation', normalizedCategory: 'Transportation', description: 'Passenger railways and commuter services', exampleBrands: ['Amtrak'] },
  { mcc: 4121, category: 'Transportation - Rideshare', normalizedCategory: 'Transportation', description: 'Taxi and rideshare services', exampleBrands: ['Uber', 'Lyft'] },
  { mcc: 4511, category: 'Travel - Airlines', normalizedCategory: 'Travel', description: 'Airlines and air carriers', exampleBrands: ['Delta Air Lines', 'United Airlines'] },
  { mcc: 4722, category: 'Travel - Agencies', normalizedCategory: 'Travel', description: 'Travel agencies and online travel booking', exampleBrands: ['Expedia'] },
  { mcc: 7011, category: 'Travel - Lodging', normalizedCategory: 'Travel', description: 'Hotels, motels, and resorts', exampleBrands: ['Marriott'] },
  { mcc: 5541, category: 'Gas Stations', normalizedCategory: 'Gas', description: 'Fuel and convenience services', exampleBrands: ['Shell', 'BP'] },
  { mcc: 5912, category: 'Drug Stores and Pharmacies', normalizedCategory: 'Other', description: 'Pharmacy, drug store, and health retail purchases', exampleBrands: ['CVS', 'Walgreens'] },
  { mcc: 5942, category: 'Book Stores', normalizedCategory: 'Online Shopping', description: 'Bookstores and mixed online retail catalogs', exampleBrands: ['Barnes & Noble'] },
  { mcc: 5999, category: 'Miscellaneous Retail', normalizedCategory: 'Other', description: 'Specialty retail merchants without a stronger category', exampleBrands: ['Best Buy'] },
  { mcc: 7832, category: 'Entertainment - Movie Theaters', normalizedCategory: 'Entertainment', description: 'Movie theaters and ticketing', exampleBrands: ['AMC Theatres'] },
  { mcc: 7922, category: 'Entertainment - Live Events', normalizedCategory: 'Entertainment', description: 'Concerts, events, and theatrical producers', exampleBrands: ['Ticketmaster'] },
];

const brands = [
  { id: 'amazon', name: 'Amazon', category: 'Online Shopping', mcc: 5311, brandLogo: 'https://logo.clearbit.com/amazon.com', commonLocations: [] },
  { id: 'starbucks', name: 'Starbucks', category: 'Coffee Shop', mcc: 5814, commonLocations: [{ lat: 40.7128, lon: -74.006, address: 'New York, NY' }] },
  { id: 'whole_foods', name: 'Whole Foods Market', category: 'Groceries', mcc: 5411, commonLocations: [{ lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' }] },
  { id: 'shell', name: 'Shell Gas Station', category: 'Gas Station', mcc: 5541, commonLocations: [{ lat: 29.7604, lon: -95.3698, address: 'Houston, TX' }] },
  { id: 'target', name: 'Target', category: 'Online Shopping', mcc: 5311, brandLogo: 'https://logo.clearbit.com/target.com', commonLocations: [{ lat: 44.9778, lon: -93.265, address: 'Minneapolis, MN' }] },
  { id: 'kroger', name: 'Kroger', category: 'Groceries', mcc: 5411, brandLogo: 'https://logo.clearbit.com/kroger.com', commonLocations: [{ lat: 39.1031, lon: -84.512, address: 'Cincinnati, OH' }] },
  { id: 'trader_joes', name: 'Trader Joe\'s', category: 'Groceries', mcc: 5411, brandLogo: 'https://logo.clearbit.com/traderjoes.com', commonLocations: [{ lat: 34.0522, lon: -118.2437, address: 'Los Angeles, CA' }] },
  { id: 'uber', name: 'Uber', category: 'Rideshare', mcc: 4121, brandLogo: 'https://logo.clearbit.com/uber.com', commonLocations: [{ lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' }] },
  { id: 'amtrak', name: 'Amtrak', category: 'Passenger Rail', mcc: 4112, brandLogo: 'https://logo.clearbit.com/amtrak.com', commonLocations: [{ lat: 38.8977, lon: -77.0062, address: 'Washington Union Station' }] },
  { id: 'delta', name: 'Delta Air Lines', category: 'Airline', mcc: 4511, brandLogo: 'https://logo.clearbit.com/delta.com', commonLocations: [{ lat: 33.6407, lon: -84.4277, address: 'Atlanta, GA' }] },
  { id: 'marriott', name: 'Marriott', category: 'Hotel', mcc: 7011, brandLogo: 'https://logo.clearbit.com/marriott.com', commonLocations: [{ lat: 38.9072, lon: -77.0369, address: 'Washington, DC' }] },
  { id: 'amc_theatres', name: 'AMC Theatres', category: 'Movie Theater', mcc: 7832, brandLogo: 'https://logo.clearbit.com/amctheatres.com', commonLocations: [{ lat: 39.0997, lon: -94.5786, address: 'Kansas City, MO' }] },
  { id: 'ticketmaster', name: 'Ticketmaster', category: 'Live Events', mcc: 7922, brandLogo: 'https://logo.clearbit.com/ticketmaster.com', commonLocations: [{ lat: 34.0522, lon: -118.2437, address: 'Los Angeles, CA' }] },
  { id: 'expedia', name: 'Expedia', category: 'Travel Booking', mcc: 4722, brandLogo: 'https://logo.clearbit.com/expedia.com', commonLocations: [] },
  { id: 'mcdonalds', name: 'McDonald\'s', category: 'Fast Food', mcc: 5814, brandLogo: 'https://logo.clearbit.com/mcdonalds.com', commonLocations: [{ lat: 41.8781, lon: -87.6298, address: 'Chicago, IL' }] },
  { id: 'chipotle', name: 'Chipotle', category: 'Fast Casual', mcc: 5814, brandLogo: 'https://logo.clearbit.com/chipotle.com', commonLocations: [{ lat: 39.7392, lon: -104.9903, address: 'Denver, CO' }] },
  { id: 'walmart', name: 'Walmart', category: 'Groceries', mcc: 5411, brandLogo: 'https://logo.clearbit.com/walmart.com', commonLocations: [{ lat: 36.3729, lon: -94.2088, address: 'Bentonville, AR' }] },
  { id: 'costco', name: 'Costco', category: 'Groceries', mcc: 5411, brandLogo: 'https://logo.clearbit.com/costco.com', commonLocations: [{ lat: 47.6101, lon: -122.2015, address: 'Issaquah, WA' }] },
  { id: 'bp', name: 'BP', category: 'Gas Station', mcc: 5541, brandLogo: 'https://logo.clearbit.com/bp.com', commonLocations: [{ lat: 41.8781, lon: -87.6298, address: 'Chicago, IL' }] },
  { id: 'chevron', name: 'Chevron', category: 'Gas Station', mcc: 5541, brandLogo: 'https://logo.clearbit.com/chevron.com', commonLocations: [{ lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' }] },
  { id: 'lyft', name: 'Lyft', category: 'Rideshare', mcc: 4121, brandLogo: 'https://logo.clearbit.com/lyft.com', commonLocations: [{ lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' }] },
  { id: 'united', name: 'United Airlines', category: 'Airline', mcc: 4511, brandLogo: 'https://logo.clearbit.com/united.com', commonLocations: [{ lat: 41.9742, lon: -87.9073, address: 'Chicago O\'Hare' }] },
  { id: 'hilton', name: 'Hilton', category: 'Hotel', mcc: 7011, brandLogo: 'https://logo.clearbit.com/hilton.com', commonLocations: [{ lat: 38.9072, lon: -77.0369, address: 'Washington, DC' }] },
  { id: 'cvs', name: 'CVS Pharmacy', category: 'Pharmacy', mcc: 5912, brandLogo: 'https://logo.clearbit.com/cvs.com', commonLocations: [{ lat: 42.3601, lon: -71.0589, address: 'Boston, MA' }] },
  { id: 'walgreens', name: 'Walgreens', category: 'Pharmacy', mcc: 5912, brandLogo: 'https://logo.clearbit.com/walgreens.com', commonLocations: [{ lat: 41.8781, lon: -87.6298, address: 'Chicago, IL' }] },
  { id: 'barnes_noble', name: 'Barnes & Noble', category: 'Books', mcc: 5942, brandLogo: 'https://logo.clearbit.com/barnesandnoble.com', commonLocations: [{ lat: 40.7128, lon: -74.006, address: 'New York, NY' }] },
  { id: 'best_buy', name: 'Best Buy', category: 'Electronics', mcc: 5999, brandLogo: 'https://logo.clearbit.com/bestbuy.com', commonLocations: [{ lat: 44.9778, lon: -93.265, address: 'Minneapolis, MN' }] },
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
  console.log('Knowledge layer schema audit passed');
}

async function upsertCollection(db, collectionName, docs, keyField) {
  const now = new Date().toISOString();
  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { [keyField]: doc[keyField] },
      update: { $set: { ...doc, lastUpdated: now } },
      upsert: true,
    },
  }));

  await db.collection(collectionName).bulkWrite(operations, { ordered: true });
  console.log(`Seeded ${docs.length} docs into ${collectionName}`);
}

try {
  console.log('Starting MongoDB knowledge-layer seeding...');
  auditKnowledgeLayer();
  const db = await getDb();
  await ensureIndexes(db);
  await upsertCollection(db, 'cards', cards, 'id');
  await upsertCollection(db, 'brands', brands, 'id');
  await upsertCollection(db, 'mcc_map', mccMap, 'mcc');
  console.log('All MongoDB seed data written successfully');
  await closeDb();
  process.exit(0);
} catch (error) {
  console.error('Seeding failed:', error);
  if (String(error?.message || '').includes('tlsv1 alert internal error')) {
    console.error(
      'MongoDB Atlas rejected the TLS connection before writes. Check Atlas Network Access/IP allowlist for this machine and confirm the cluster is active.'
    );
  }
  await closeDb().catch(() => {});
  process.exit(1);
}
