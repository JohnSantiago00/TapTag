const baseUrl = process.env.TAPTAG_API_SMOKE_URL || 'http://127.0.0.1:4000';

const checks = [
  { path: '/health', validate: (body) => body?.ok === true },
  { path: '/api/cards', validate: (body) => Array.isArray(body) && body.length >= 8 },
  { path: '/api/brands', validate: (body) => Array.isArray(body) && body.length >= 10 },
  { path: '/api/mcc-map', validate: (body) => Array.isArray(body) && body.length >= 10 },
];

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${check.path} returned ${response.status}`);
  }

  const body = await response.json();
  if (!check.validate(body)) {
    throw new Error(`${check.path} returned an unexpected payload`);
  }

  console.log(`OK ${check.path}`);
}

console.log(`TapTag API smoke check passed for ${baseUrl}`);
