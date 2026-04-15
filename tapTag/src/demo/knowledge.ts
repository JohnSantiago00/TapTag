export const DEMO_CARDS = [
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
  },
  {
    id: 'citi_custom_cash',
    name: 'Citi Custom Cash Card',
    issuer: 'Citi',
    network: 'Mastercard',
    rewardRules: [
      { category: 'Dining', rate: 5 },
      { category: 'Groceries', rate: 5 },
      { category: 'Gas', rate: 5 },
      { category: 'Other', rate: 1 },
    ],
    annualFee: 0,
  },
];

export const DEMO_MCC_MAPPINGS = [
  {
    id: '5812',
    mcc: 5812,
    category: 'Dining - Restaurants',
    normalizedCategory: 'Dining',
    description: 'Full-service dining establishments',
  },
  {
    id: '5814',
    mcc: 5814,
    category: 'Dining - Coffee Shop',
    normalizedCategory: 'Dining',
    description: 'Cafes and coffeehouses',
  },
  {
    id: '5311',
    mcc: 5311,
    category: 'Online Shopping',
    normalizedCategory: 'Online Shopping',
    description: 'Online marketplaces and e-commerce merchants',
  },
  {
    id: '5411',
    mcc: 5411,
    category: 'Groceries',
    normalizedCategory: 'Groceries',
    description: 'Supermarkets and grocery stores',
  },
  {
    id: '4112',
    mcc: 4112,
    category: 'Transportation',
    normalizedCategory: 'Transportation',
    description: 'Passenger railways and commuter services',
  },
  {
    id: '5541',
    mcc: 5541,
    category: 'Gas Stations',
    normalizedCategory: 'Gas',
    description: 'Fuel and convenience services',
  },
];

export const DEMO_BRANDS = [
  {
    id: 'amazon',
    name: 'Amazon',
    category: 'Online Shopping',
    mcc: 5311,
    commonLocations: [],
  },
  {
    id: 'starbucks',
    name: 'Starbucks',
    category: 'Coffee Shop',
    mcc: 5814,
    commonLocations: [{ lat: 40.7128, lon: -74.006, address: 'New York, NY' }],
  },
  {
    id: 'whole_foods',
    name: 'Whole Foods Market',
    category: 'Groceries',
    mcc: 5411,
    commonLocations: [{ lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' }],
  },
  {
    id: 'shell',
    name: 'Shell Gas Station',
    category: 'Gas Station',
    mcc: 5541,
    commonLocations: [{ lat: 29.7604, lon: -95.3698, address: 'Houston, TX' }],
  },
];
