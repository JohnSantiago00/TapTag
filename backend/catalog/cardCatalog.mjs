export const CARD_CATALOG_SCHEMA_VERSION = 1;
export const CARD_CATALOG_AS_OF = '2026-07-11';

const VALID_NETWORKS = new Set(['Visa', 'Mastercard', 'Amex', 'Discover']);
const VALID_UNITS = new Set(['points', 'miles', 'percent']);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_CATEGORIES = new Set([
  'Dining',
  'Groceries',
  'Gas',
  'Travel',
  'Transportation',
  'Entertainment',
  'Online Shopping',
  'Other',
]);

const source = (id, title, url) => ({ id, title, url, publisherType: 'issuer' });
const rule = (id, category, rate, unit, details = {}) => ({
  id,
  category,
  rate,
  unit,
  ...details,
});
const legacy = (...entries) =>
  entries.map(([category, rate]) => ({ category, rate }));

function product({
  id,
  name,
  issuer,
  network,
  annualFee,
  currency,
  issuerWebsite,
  earningRules,
  rewardRules,
  sources,
  availability = 'open_to_applicants',
  requirements = [],
  notes = [],
}) {
  return {
    schemaVersion: CARD_CATALOG_SCHEMA_VERSION,
    id,
    name,
    issuer,
    network,
    market: 'US',
    status: 'active',
    availability,
    annualFee,
    annualFeeDetails: { amount: annualFee, currency: 'USD' },
    rewardCurrency: currency,
    issuerWebsite,
    earningRules,
    // Conservative projection used by the current category-only recommender.
    // Conditional portal, activation, top-spend, and rotating rules stay in
    // earningRules until the recommendation context can prove eligibility.
    rewardRules,
    requirements,
    notes,
    sources,
    effectiveFrom: '2026-07-01',
    reviewedAt: CARD_CATALOG_AS_OF,
    nextReviewAt: '2026-09-15',
  };
}

const currencies = {
  amex: { type: 'points', name: 'Membership Rewards' },
  chase: { type: 'points', name: 'Ultimate Rewards' },
  cashback: { type: 'cashback', name: 'Cash back' },
  citi: { type: 'points', name: 'ThankYou Points' },
  capitalOne: { type: 'miles', name: 'Capital One miles' },
  wellsFargo: { type: 'points', name: 'Wells Fargo Rewards' },
};

export const cards = [
  product({
    id: 'amex_gold',
    name: 'American Express Gold Card',
    issuer: 'American Express',
    network: 'Amex',
    annualFee: 325,
    currency: currencies.amex,
    issuerWebsite: 'https://www.americanexpress.com/us/credit-cards/card/gold-card/',
    earningRules: [
      rule('gold-dining', 'Dining', 4, 'points', { cap: { amount: 50000, period: 'calendar_year' }, afterCapRate: 1, geography: 'worldwide', sourceIds: ['amex-gold'] }),
      rule('gold-grocery', 'Groceries', 4, 'points', { cap: { amount: 25000, period: 'calendar_year' }, afterCapRate: 1, geography: 'US', exclusions: ['superstores', 'convenience stores', 'warehouse clubs', 'meal-kit delivery'], sourceIds: ['amex-gold'] }),
      rule('gold-hotels', 'Travel', 5, 'points', { subcategories: ['prepaid hotels'], channels: ['Amex Travel'], sourceIds: ['amex-gold'] }),
      rule('gold-flights', 'Travel', 3, 'points', { subcategories: ['flights'], channels: ['direct with airline', 'Amex Travel'], sourceIds: ['amex-gold'] }),
      rule('gold-cars-cruises', 'Travel', 2, 'points', { subcategories: ['prepaid car rentals', 'cruises'], channels: ['Amex Travel'], sourceIds: ['amex-gold'] }),
      rule('gold-base', 'Other', 1, 'points', { sourceIds: ['amex-gold'] }),
    ],
    rewardRules: legacy(['Dining', 4], ['Groceries', 4], ['Travel', 1], ['Other', 1]),
    sources: [source('amex-gold', 'American Express Gold Card product page', 'https://www.americanexpress.com/us/credit-cards/card/gold-card/')],
  }),
  product({
    id: 'amex_platinum',
    name: 'The Platinum Card from American Express',
    issuer: 'American Express',
    network: 'Amex',
    annualFee: 895,
    currency: currencies.amex,
    issuerWebsite: 'https://www.americanexpress.com/us/credit-cards/card/platinum/',
    earningRules: [
      rule('platinum-flights', 'Travel', 5, 'points', { subcategories: ['flights'], channels: ['direct with airline', 'Amex Travel'], cap: { amount: 500000, period: 'calendar_year' }, afterCapRate: 1, sourceIds: ['amex-platinum'] }),
      rule('platinum-hotels', 'Travel', 5, 'points', { subcategories: ['prepaid hotels'], channels: ['Amex Travel'], sourceIds: ['amex-platinum'] }),
      rule('platinum-base', 'Other', 1, 'points', { sourceIds: ['amex-platinum'] }),
    ],
    rewardRules: legacy(['Travel', 1], ['Other', 1]),
    sources: [source('amex-platinum', 'American Express Platinum Card product page', 'https://www.americanexpress.com/us/credit-cards/card/platinum/')],
  }),
  product({
    id: 'blue_cash_preferred',
    name: 'Blue Cash Preferred Card from American Express',
    issuer: 'American Express',
    network: 'Amex',
    annualFee: 95,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.americanexpress.com/us/credit-cards/card/blue-cash-preferred/',
    earningRules: [
      rule('bcp-grocery', 'Groceries', 6, 'percent', { geography: 'US', cap: { amount: 6000, period: 'calendar_year' }, afterCapRate: 1, sourceIds: ['amex-bcp'] }),
      rule('bcp-streaming', 'Entertainment', 6, 'percent', { subcategories: ['select streaming'], geography: 'US', sourceIds: ['amex-bcp'] }),
      rule('bcp-gas', 'Gas', 3, 'percent', { geography: 'US', sourceIds: ['amex-bcp'] }),
      rule('bcp-transit', 'Transportation', 3, 'percent', { sourceIds: ['amex-bcp'] }),
      rule('bcp-base', 'Other', 1, 'percent', { sourceIds: ['amex-bcp'] }),
    ],
    rewardRules: legacy(['Groceries', 6], ['Gas', 3], ['Transportation', 3], ['Other', 1]),
    sources: [source('amex-bcp', 'Blue Cash Preferred benefits', 'https://global.americanexpress.com/card-benefits/view-all/blue-cash-preferred')],
  }),
  product({
    id: 'blue_cash_everyday',
    name: 'Blue Cash Everyday Card from American Express',
    issuer: 'American Express',
    network: 'Amex',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.americanexpress.com/us/credit-cards/card/blue-cash-everyday/',
    earningRules: [
      ...['Groceries', 'Gas', 'Online Shopping'].map((category) => rule(`bce-${category.toLowerCase().replace(' ', '-')}`, category, 3, 'percent', { geography: 'US', cap: { amount: 6000, period: 'calendar_year', separatePerRule: true }, afterCapRate: 1, sourceIds: ['amex-bce'] })),
      rule('bce-base', 'Other', 1, 'percent', { sourceIds: ['amex-bce'] }),
    ],
    rewardRules: legacy(['Groceries', 3], ['Gas', 3], ['Online Shopping', 3], ['Other', 1]),
    sources: [source('amex-bce', 'Blue Cash Everyday product page', 'https://www.americanexpress.com/us/credit-cards/card/blue-cash-everyday/')],
  }),
  product({
    id: 'chase_sapphire_preferred',
    name: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 95,
    currency: currencies.chase,
    issuerWebsite: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
    earningRules: [
      rule('csp-portal', 'Travel', 5, 'points', { channels: ['Chase Travel'], sourceIds: ['chase-csp'] }),
      ...['Dining', 'Gas'].map((category) => rule(`csp-${category.toLowerCase()}`, category, 3, 'points', { sourceIds: ['chase-csp'] })),
      rule('csp-vacation-homes', 'Travel', 3, 'points', { subcategories: ['vacation homes'], merchantExamples: ['Airbnb', 'Vrbo'], sourceIds: ['chase-csp'] }),
      rule('csp-online-grocery', 'Groceries', 3, 'points', { channels: ['online'], exclusions: ['Target', 'Walmart', 'wholesale clubs'], sourceIds: ['chase-csp'] }),
      rule('csp-streaming', 'Entertainment', 3, 'points', { subcategories: ['select streaming'], sourceIds: ['chase-csp'] }),
      rule('csp-travel', 'Travel', 2, 'points', { exclusions: ['Chase Travel purchases earning 5x'], sourceIds: ['chase-csp'] }),
      rule('csp-base', 'Other', 1, 'points', { sourceIds: ['chase-csp'] }),
    ],
    rewardRules: legacy(['Dining', 3], ['Gas', 3], ['Travel', 2], ['Other', 1]),
    sources: [source('chase-csp', 'Chase Sapphire Preferred benefits', 'https://www.chase.com/sapphire-cards/personal/preferred')],
    notes: ['Catalog reflects the June 15, 2026 product refresh.'],
  }),
  product({
    id: 'chase_sapphire_reserve',
    name: 'Chase Sapphire Reserve',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 795,
    currency: currencies.chase,
    issuerWebsite: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve',
    earningRules: [
      rule('csr-portal', 'Travel', 8, 'points', { channels: ['Chase Travel'], sourceIds: ['chase-csr'] }),
      rule('csr-direct-flight-hotel', 'Travel', 4, 'points', { subcategories: ['flights', 'hotels'], channels: ['direct with travel provider'], sourceIds: ['chase-csr'] }),
      rule('csr-dining', 'Dining', 3, 'points', { geography: 'worldwide', sourceIds: ['chase-csr'] }),
      rule('csr-base', 'Other', 1, 'points', { sourceIds: ['chase-csr'] }),
    ],
    rewardRules: legacy(['Dining', 3], ['Travel', 1], ['Other', 1]),
    sources: [source('chase-csr', 'Chase Sapphire Reserve product page', 'https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve')],
  }),
  product({
    id: 'chase_freedom_unlimited',
    name: 'Chase Freedom Unlimited',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.chase.com/personal/credit-cards/freedom/unlimited',
    earningRules: [
      rule('cfu-portal', 'Travel', 5, 'percent', { channels: ['Chase Travel'], sourceIds: ['chase-cfu'] }),
      ...['Dining', 'Drugstores'].map((category) => rule(`cfu-${category.toLowerCase()}`, category, 3, 'percent', { sourceIds: ['chase-cfu'] })),
      rule('cfu-base', 'Other', 1.5, 'percent', { sourceIds: ['chase-cfu'] }),
    ],
    rewardRules: legacy(['Dining', 3], ['Travel', 1.5], ['Other', 1.5]),
    sources: [source('chase-cfu', 'Chase Freedom Unlimited product page', 'https://www.chase.com/personal/credit-cards/freedom/unlimited')],
  }),
  product({
    id: 'chase_freedom_flex',
    name: 'Chase Freedom Flex',
    issuer: 'Chase',
    network: 'Mastercard',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.chase.com/personal/credit-cards/freedom/flex',
    earningRules: [
      rule('cff-2026q3-gas', 'Gas', 5, 'percent', { subcategories: ['gas stations', 'EV charging'], requiresActivation: true, validFrom: '2026-07-01', validThrough: '2026-09-30', cap: { amount: 1500, period: 'promotion', sharedGroup: 'cff-2026q3' }, afterCapRate: 1, sourceIds: ['chase-cff-q3'] }),
      rule('cff-2026q3-transit', 'Transportation', 5, 'percent', { subcategories: ['passenger trains', 'buses', 'ferries', 'tolls', 'parking'], exclusions: ['taxis', 'rideshare', 'bike and scooter rentals', 'car sharing'], requiresActivation: true, validFrom: '2026-07-01', validThrough: '2026-09-30', cap: { amount: 1500, period: 'promotion', sharedGroup: 'cff-2026q3' }, afterCapRate: 1, sourceIds: ['chase-cff-q3'] }),
      rule('cff-2026q3-live', 'Entertainment', 5, 'percent', { subcategories: ['select live entertainment'], exclusions: ['movie theaters', 'bowling alleys', 'casinos', 'dance clubs'], requiresActivation: true, validFrom: '2026-07-01', validThrough: '2026-09-30', cap: { amount: 1500, period: 'promotion', sharedGroup: 'cff-2026q3' }, afterCapRate: 1, sourceIds: ['chase-cff-q3'] }),
      rule('cff-portal', 'Travel', 5, 'percent', { channels: ['Chase Travel'], sourceIds: ['chase-cff'] }),
      ...['Dining', 'Drugstores'].map((category) => rule(`cff-${category.toLowerCase()}`, category, 3, 'percent', { sourceIds: ['chase-cff'] })),
      rule('cff-base', 'Other', 1, 'percent', { sourceIds: ['chase-cff'] }),
    ],
    rewardRules: legacy(['Dining', 3], ['Travel', 1], ['Other', 1]),
    sources: [
      source('chase-cff', 'Chase Freedom Flex product page', 'https://www.chase.com/personal/credit-cards/freedom/flex'),
      source('chase-cff-q3', 'Chase Freedom Q3 2026 categories', 'https://media.chase.com/news/chase-freedom-2026-q3-categories'),
    ],
    notes: ['Q3 public transit excludes taxis and rideshare; entertainment is select live entertainment.'],
  }),
  product({
    id: 'prime_visa',
    name: 'Prime Visa',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://creditcards.chase.com/cash-back-credit-cards/amazon-prime-rewards',
    requirements: ['Eligible Prime membership required for the listed 5% rates.'],
    earningRules: [
      rule('prime-amazon', 'Online Shopping', 5, 'percent', { merchants: ['Amazon.com', 'Whole Foods Market', 'eligible Amazon stores'], sourceIds: ['chase-prime'] }),
      rule('prime-portal', 'Travel', 5, 'percent', { channels: ['Chase Travel'], sourceIds: ['chase-prime'] }),
      ...['Dining', 'Gas', 'Transportation'].map((category) => rule(`prime-${category.toLowerCase()}`, category, 2, 'percent', { sourceIds: ['chase-prime'] })),
      rule('prime-base', 'Other', 1, 'percent', { sourceIds: ['chase-prime'] }),
    ],
    rewardRules: legacy(['Online Shopping', 5], ['Dining', 2], ['Gas', 2], ['Transportation', 2], ['Travel', 1], ['Other', 1]),
    sources: [source('chase-prime', 'Prime Visa product terms', 'https://creditcards.chase.com/cash-back-credit-cards/amazon-prime-rewards')],
  }),
  product({
    id: 'citi_strata_premier',
    name: 'Citi Strata Premier Card',
    issuer: 'Citi',
    network: 'Mastercard',
    annualFee: 95,
    currency: currencies.citi,
    issuerWebsite: 'https://www.citi.com/credit-cards/citi-strata-premier-credit-card',
    earningRules: [
      rule('strata-portal', 'Travel', 10, 'points', { subcategories: ['hotels', 'car rentals', 'attractions'], channels: ['Citi Travel'], sourceIds: ['citi-strata'] }),
      ...['Dining', 'Groceries', 'Gas'].map((category) => rule(`strata-${category.toLowerCase()}`, category, 3, 'points', { sourceIds: ['citi-strata'] })),
      rule('strata-air-hotel', 'Travel', 3, 'points', { subcategories: ['air travel', 'hotels'], sourceIds: ['citi-strata'] }),
      rule('strata-base', 'Other', 1, 'points', { sourceIds: ['citi-strata'] }),
    ],
    rewardRules: legacy(['Dining', 3], ['Groceries', 3], ['Gas', 3], ['Travel', 1], ['Other', 1]),
    sources: [source('citi-strata', 'Citi Strata Premier product page', 'https://www.citi.com/credit-cards/citi-strata-premier-credit-card')],
  }),
  product({
    id: 'citi_custom_cash',
    name: 'Citi Custom Cash Card',
    issuer: 'Citi',
    network: 'Mastercard',
    annualFee: 0,
    currency: currencies.citi,
    issuerWebsite: 'https://www.citi.com/credit-cards/citi-custom-cash-credit-card',
    earningRules: [
      rule('custom-top-category', 'Dynamic top eligible category', 5, 'percent', { selector: 'highest_spend_eligible_category', eligibleCategories: ['Dining', 'Gas', 'Groceries', 'Travel', 'Transportation', 'Entertainment', 'Drugstores', 'Home Improvement', 'Fitness Clubs', 'Streaming'], cap: { amount: 500, period: 'billing_cycle' }, afterCapRate: 1, sourceIds: ['citi-custom'] }),
      rule('custom-portal', 'Travel', 5, 'percent', { subcategories: ['hotels', 'car rentals', 'attractions'], channels: ['Citi Travel'], sourceIds: ['citi-custom'] }),
      rule('custom-base', 'Other', 1, 'percent', { sourceIds: ['citi-custom'] }),
    ],
    rewardRules: legacy(['Other', 1]),
    sources: [source('citi-custom', 'Citi Custom Cash product page', 'https://www.citi.com/credit-cards/citi-custom-cash-credit-card')],
    notes: ['TapTag must know billing-cycle spend before recommending the adaptive 5% category.'],
  }),
  product({
    id: 'citi_double_cash',
    name: 'Citi Double Cash Card',
    issuer: 'Citi',
    network: 'Mastercard',
    annualFee: 0,
    currency: currencies.citi,
    issuerWebsite: 'https://www.citi.com/credit-cards/citi-double-cash-credit-card',
    earningRules: [
      rule('double-portal', 'Travel', 5, 'percent', { subcategories: ['hotels', 'car rentals', 'attractions'], channels: ['Citi Travel'], sourceIds: ['citi-double'] }),
      rule('double-base', 'Other', 2, 'percent', { details: '1% when purchasing plus 1% as the purchase balance is paid.', sourceIds: ['citi-double'] }),
    ],
    rewardRules: legacy(['Other', 2]),
    sources: [source('citi-double', 'Citi Double Cash product page', 'https://www.citi.com/credit-cards/citi-double-cash-credit-card')],
  }),
  product({
    id: 'costco_anywhere_visa',
    name: 'Costco Anywhere Visa Card by Citi',
    issuer: 'Citi',
    network: 'Visa',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.citi.com/credit-cards/citi-costco-anywhere-visa-credit-card',
    requirements: ['Active paid Costco membership required.'],
    earningRules: [
      rule('costco-gas', 'Gas', 5, 'percent', { merchants: ['Costco gas'], cap: { amount: 7000, period: 'calendar_year', sharedGroup: 'costco-fuel' }, afterCapRate: 1, sourceIds: ['citi-costco'] }),
      rule('costco-other-gas', 'Gas', 4, 'percent', { subcategories: ['eligible gas', 'EV charging'], cap: { amount: 7000, period: 'calendar_year', sharedGroup: 'costco-fuel' }, afterCapRate: 1, exclusions: ['fuel at non-Costco superstores, supermarkets, and warehouse clubs'], sourceIds: ['citi-costco'] }),
      ...['Dining', 'Travel'].map((category) => rule(`costco-${category.toLowerCase()}`, category, 3, 'percent', { sourceIds: ['citi-costco'] })),
      rule('costco-purchases', 'Groceries', 2, 'percent', { merchants: ['Costco', 'Costco.com'], sourceIds: ['citi-costco'] }),
      rule('costco-base', 'Other', 1, 'percent', { sourceIds: ['citi-costco'] }),
    ],
    rewardRules: legacy(['Gas', 4], ['Dining', 3], ['Travel', 3], ['Groceries', 2], ['Other', 1]),
    sources: [source('citi-costco', 'Costco Anywhere Visa product page', 'https://www.citi.com/credit-cards/citi-costco-anywhere-visa-credit-card')],
  }),
  product({
    id: 'capital_one_savor',
    name: 'Capital One Savor Cash Rewards',
    issuer: 'Capital One',
    network: 'Mastercard',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.capitalone.com/credit-cards/savor/',
    earningRules: [
      rule('savor-entertainment-portal', 'Entertainment', 8, 'percent', { channels: ['Capital One Entertainment'], sourceIds: ['capitalone-savor'] }),
      rule('savor-travel', 'Travel', 5, 'percent', { channels: ['Capital One Travel'], sourceIds: ['capitalone-savor'] }),
      ...['Dining', 'Groceries', 'Entertainment'].map((category) => rule(`savor-${category.toLowerCase()}`, category, 3, 'percent', { exclusions: category === 'Groceries' ? ['Walmart', 'Target', 'other superstores'] : undefined, sourceIds: ['capitalone-savor'] })),
      rule('savor-streaming', 'Entertainment', 3, 'percent', { subcategories: ['eligible streaming'], sourceIds: ['capitalone-savor'] }),
      rule('savor-base', 'Other', 1, 'percent', { sourceIds: ['capitalone-savor'] }),
    ],
    rewardRules: legacy(['Dining', 3], ['Groceries', 3], ['Entertainment', 3], ['Other', 1]),
    sources: [source('capitalone-savor', 'Capital One Savor product page', 'https://www.capitalone.com/credit-cards/savor/')],
  }),
  product({
    id: 'capital_one_venture',
    name: 'Capital One Venture Rewards',
    issuer: 'Capital One',
    network: 'Visa',
    annualFee: 95,
    currency: currencies.capitalOne,
    issuerWebsite: 'https://www.capitalone.com/credit-cards/venture/',
    earningRules: [
      rule('venture-travel', 'Travel', 5, 'miles', { subcategories: ['hotels', 'vacation rentals', 'rental cars', 'activities'], channels: ['Capital One Travel'], sourceIds: ['capitalone-venture'] }),
      rule('venture-entertainment', 'Entertainment', 5, 'miles', { channels: ['Capital One Entertainment'], sourceIds: ['capitalone-venture'] }),
      rule('venture-base', 'Other', 2, 'miles', { sourceIds: ['capitalone-venture'] }),
    ],
    rewardRules: legacy(['Other', 2]),
    sources: [source('capitalone-venture', 'Capital One Venture product page', 'https://www.capitalone.com/credit-cards/venture/')],
  }),
  product({
    id: 'capital_one_venture_x',
    name: 'Capital One Venture X Rewards',
    issuer: 'Capital One',
    network: 'Visa',
    annualFee: 395,
    currency: currencies.capitalOne,
    issuerWebsite: 'https://www.capitalone.com/credit-cards/venture-x/',
    earningRules: [
      rule('venturex-hotels-cars', 'Travel', 10, 'miles', { subcategories: ['hotels', 'rental cars'], channels: ['Capital One Travel'], sourceIds: ['capitalone-venturex'] }),
      rule('venturex-travel', 'Travel', 5, 'miles', { subcategories: ['flights', 'vacation rentals', 'activities'], channels: ['Capital One Travel'], sourceIds: ['capitalone-venturex'] }),
      rule('venturex-entertainment', 'Entertainment', 5, 'miles', { channels: ['Capital One Entertainment'], sourceIds: ['capitalone-venturex'] }),
      rule('venturex-base', 'Other', 2, 'miles', { sourceIds: ['capitalone-venturex'] }),
    ],
    rewardRules: legacy(['Other', 2]),
    sources: [source('capitalone-venturex', 'Capital One Venture X product page', 'https://www.capitalone.com/credit-cards/venture-x/')],
  }),
  product({
    id: 'wells_fargo_autograph',
    name: 'Wells Fargo Autograph Card',
    issuer: 'Wells Fargo',
    network: 'Visa',
    annualFee: 0,
    currency: currencies.wellsFargo,
    issuerWebsite: 'https://www.wellsfargo.com/credit-cards/autograph-visa/',
    earningRules: [
      ...['Dining', 'Travel', 'Gas', 'Transportation'].map((category) => rule(`autograph-${category.toLowerCase()}`, category, 3, 'points', { sourceIds: ['wf-autograph'] })),
      rule('autograph-streaming', 'Entertainment', 3, 'points', { subcategories: ['popular streaming'], sourceIds: ['wf-autograph'] }),
      rule('autograph-phone', 'Phone plans', 3, 'points', { sourceIds: ['wf-autograph'] }),
      rule('autograph-base', 'Other', 1, 'points', { sourceIds: ['wf-autograph'] }),
    ],
    rewardRules: legacy(['Dining', 3], ['Travel', 3], ['Gas', 3], ['Transportation', 3], ['Other', 1]),
    sources: [source('wf-autograph', 'Wells Fargo Autograph terms', 'https://www.wellsfargo.com/credit-cards/autograph-visa/terms/')],
  }),
  product({
    id: 'wells_fargo_active_cash',
    name: 'Wells Fargo Active Cash Card',
    issuer: 'Wells Fargo',
    network: 'Visa',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.wellsfargo.com/credit-cards/active-cash/',
    earningRules: [rule('active-cash-base', 'Other', 2, 'percent', { sourceIds: ['wf-active-cash'] })],
    rewardRules: legacy(['Other', 2]),
    sources: [source('wf-active-cash', 'Wells Fargo Active Cash terms', 'https://www.wellsfargo.com/credit-cards/active-cash/terms/')],
  }),
  product({
    id: 'bank_of_america_customized_cash',
    name: 'Bank of America Customized Cash Rewards',
    issuer: 'Bank of America',
    network: 'Visa',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.bankofamerica.com/credit-cards/products/cash-back-credit-card/',
    earningRules: [
      rule('boa-choice', 'Selected category', 3, 'percent', { selector: 'cardholder_selected_category', eligibleCategories: ['Gas and EV charging', 'Online Shopping and Internet/Cable/Streaming', 'Dining', 'Travel', 'Drugstores', 'Home Improvement'], cap: { amount: 2500, period: 'calendar_quarter', sharedGroup: 'boa-choice-grocery' }, afterCapRate: 1, sourceIds: ['boa-customized'] }),
      rule('boa-grocery', 'Groceries', 2, 'percent', { cap: { amount: 2500, period: 'calendar_quarter', sharedGroup: 'boa-choice-grocery' }, afterCapRate: 1, sourceIds: ['boa-customized'] }),
      rule('boa-wholesale', 'Wholesale clubs', 2, 'percent', { cap: { amount: 2500, period: 'calendar_quarter', sharedGroup: 'boa-choice-grocery' }, afterCapRate: 1, sourceIds: ['boa-customized'] }),
      rule('boa-base', 'Other', 1, 'percent', { sourceIds: ['boa-customized'] }),
    ],
    rewardRules: legacy(['Groceries', 2], ['Other', 1]),
    sources: [source('boa-customized', 'Bank of America cash back cards', 'https://www.bankofamerica.com/credit-cards/cash-back-credit-cards/')],
    notes: ['New accounts may receive a separate first-year bonus; the evergreen catalog rate remains 3%.'],
  }),
  product({
    id: 'discover_it_cash_back',
    name: 'Discover it Cash Back',
    issuer: 'Discover',
    network: 'Discover',
    annualFee: 0,
    currency: currencies.cashback,
    issuerWebsite: 'https://www.discover.com/credit-cards/cash-back/it-card/',
    earningRules: [
      rule('discover-2026q3-gas', 'Gas', 5, 'percent', { subcategories: ['gas stations', 'EV charging'], requiresActivation: true, validFrom: '2026-07-01', validThrough: '2026-09-30', cap: { amount: 1500, period: 'calendar_quarter', sharedGroup: 'discover-2026q3' }, afterCapRate: 1, sourceIds: ['discover-calendar'] }),
      rule('discover-2026q3-transit', 'Transportation', 5, 'percent', { subcategories: ['public transportation'], requiresActivation: true, validFrom: '2026-07-01', validThrough: '2026-09-30', cap: { amount: 1500, period: 'calendar_quarter', sharedGroup: 'discover-2026q3' }, afterCapRate: 1, sourceIds: ['discover-calendar'] }),
      rule('discover-2026q3-flights', 'Travel', 5, 'percent', { subcategories: ['flights'], requiresActivation: true, validFrom: '2026-07-01', validThrough: '2026-09-30', cap: { amount: 1500, period: 'calendar_quarter', sharedGroup: 'discover-2026q3' }, afterCapRate: 1, sourceIds: ['discover-calendar'] }),
      rule('discover-2026q3-drugstores', 'Drugstores', 5, 'percent', { requiresActivation: true, validFrom: '2026-07-01', validThrough: '2026-09-30', cap: { amount: 1500, period: 'calendar_quarter', sharedGroup: 'discover-2026q3' }, afterCapRate: 1, sourceIds: ['discover-calendar'] }),
      rule('discover-base', 'Other', 1, 'percent', { sourceIds: ['discover-it'] }),
    ],
    rewardRules: legacy(['Other', 1]),
    sources: [
      source('discover-it', 'Discover it Cash Back product page', 'https://www.discover.com/credit-cards/cash-back/it-card/'),
      source('discover-calendar', 'Discover 5% cash back calendar', 'https://www.discover.com/credit-cards/cash-back/cashback-calendar.html'),
    ],
    notes: ['Q3 categories are gas/EV charging, public transportation, flights, and drugstores.'],
  }),
];

export function validateCardCatalog(catalog = cards) {
  const errors = [];
  const ids = new Set();

  if (!Array.isArray(catalog) || catalog.length === 0) {
    return ['Catalog must contain at least one card.'];
  }

  for (const card of catalog) {
    const label = card?.id || '<missing-id>';
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(card?.id || '')) errors.push(`${label}: invalid id`);
    if (ids.has(card?.id)) errors.push(`${label}: duplicate id`);
    ids.add(card?.id);
    if (!card?.name || !card?.issuer) errors.push(`${label}: name and issuer are required`);
    if (!VALID_NETWORKS.has(card?.network)) errors.push(`${label}: unsupported network`);
    if (!Number.isFinite(card?.annualFee) || card.annualFee < 0) errors.push(`${label}: invalid annual fee`);
    if (card?.annualFeeDetails?.amount !== card?.annualFee || card?.annualFeeDetails?.currency !== 'USD') errors.push(`${label}: annual fee details do not match legacy annualFee`);
    if (!Array.isArray(card?.earningRules) || !card.earningRules.length) errors.push(`${label}: earningRules required`);
    if (!Array.isArray(card?.rewardRules) || !card.rewardRules.some((item) => item.category === 'Other')) errors.push(`${label}: conservative rewardRules must include Other`);
    if (!ISO_DATE_PATTERN.test(card?.reviewedAt || '') || !ISO_DATE_PATTERN.test(card?.nextReviewAt || '') || card.nextReviewAt <= card.reviewedAt) errors.push(`${label}: invalid review dates`);

    const sourceIds = new Set((card?.sources || []).map((item) => item.id));
    if (!sourceIds.size) errors.push(`${label}: at least one source is required`);
    if (sourceIds.size !== (card?.sources || []).length) errors.push(`${label}: duplicate source id`);
    for (const item of card?.sources || []) {
      if (!item.url?.startsWith('https://')) errors.push(`${label}: source ${item.id} must use https`);
    }
    const ruleIds = new Set();
    for (const item of card?.earningRules || []) {
      if (!item.id || ruleIds.has(item.id)) errors.push(`${label}: duplicate or missing earning rule id`);
      ruleIds.add(item.id);
      if (!Number.isFinite(item.rate) || item.rate <= 0 || !VALID_UNITS.has(item.unit)) errors.push(`${label}/${item.id}: invalid rate or unit`);
      if (!Array.isArray(item.sourceIds) || !item.sourceIds.length) errors.push(`${label}/${item.id}: at least one source id is required`);
      for (const sourceId of item.sourceIds || []) {
        if (!sourceIds.has(sourceId)) errors.push(`${label}/${item.id}: unknown source ${sourceId}`);
      }
      if (item.cap && (!Number.isFinite(item.cap.amount) || item.cap.amount <= 0 || !item.cap.period)) errors.push(`${label}/${item.id}: invalid cap`);
      if ((item.validFrom && !item.validThrough) || (!item.validFrom && item.validThrough)) errors.push(`${label}/${item.id}: promotion requires both dates`);
      if (item.validFrom && (!ISO_DATE_PATTERN.test(item.validFrom) || !ISO_DATE_PATTERN.test(item.validThrough) || item.validThrough < item.validFrom)) errors.push(`${label}/${item.id}: invalid promotion dates`);
    }
    for (const item of card?.rewardRules || []) {
      if (!LEGACY_CATEGORIES.has(item.category) || !Number.isFinite(item.rate) || item.rate <= 0) errors.push(`${label}: invalid conservative reward rule`);
    }
  }

  return errors;
}

export function getCatalogSummary(catalog = cards, today = CARD_CATALOG_AS_OF) {
  return {
    schemaVersion: CARD_CATALOG_SCHEMA_VERSION,
    asOf: CARD_CATALOG_AS_OF,
    cardCount: catalog.length,
    issuerCount: new Set(catalog.map((card) => card.issuer)).size,
    sourceCount: catalog.reduce((count, card) => count + card.sources.length, 0),
    promotionRuleCount: catalog.flatMap((card) => card.earningRules).filter((item) => item.validThrough).length,
    overdueCardIds: catalog.filter((card) => card.nextReviewAt < today).map((card) => card.id),
  };
}
