import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGooglePlacesClient,
  normalizedCategoryForPlaceTypes,
  PlacesProviderError,
} from './googlePlaces.mjs';

describe('Google Places adapter', () => {
  it('maps place types to conservative reward categories', () => {
    assert.equal(normalizedCategoryForPlaceTypes(['coffee_shop', 'food']), 'Dining');
    assert.equal(normalizedCategoryForPlaceTypes(['supermarket', 'store']), 'Groceries');
    assert.equal(normalizedCategoryForPlaceTypes(['gas_station']), 'Gas');
    assert.equal(normalizedCategoryForPlaceTypes(['clothing_store']), 'Other');
    assert.equal(normalizedCategoryForPlaceTypes(['gas_station', 'convenience_store']), 'Gas');
  });

  it('keeps credentials server-side and normalizes nearby results', async () => {
    let request;
    const client = createGooglePlacesClient({
      apiKey: 'secret-key',
      fetchImpl: async (url, init) => {
        request = { url, init };
        return new Response(JSON.stringify({
          places: [{
            id: 'place_1',
            displayName: { text: 'Corner Cafe' },
            formattedAddress: '1 Main St',
            location: { latitude: 40.1, longitude: -73.9 },
            primaryType: 'cafe',
            types: ['cafe', 'food'],
            businessStatus: 'OPERATIONAL',
            attributions: [{ provider: 'Local Data Co', providerUri: 'https://example.com' }],
          }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });

    const places = await client.searchNearby({ latitude: 40, longitude: -74 });
    assert.equal(request.url, 'https://places.googleapis.com/v1/places:searchNearby');
    assert.equal(request.init.headers['X-Goog-Api-Key'], 'secret-key');
    assert.equal(JSON.parse(request.init.body).rankPreference, 'DISTANCE');
    assert.deepEqual(places, [{
      id: 'place_1',
      name: 'Corner Cafe',
      address: '1 Main St',
      latitude: 40.1,
      longitude: -73.9,
      primaryType: 'cafe',
      normalizedCategory: 'Dining',
      attributions: [{ provider: 'Local Data Co', providerUri: 'https://example.com' }],
      provider: 'google_places',
    }]);
    assert.match(request.init.headers['X-Goog-FieldMask'], /places\.attributions/);
    assert.ok(request.init.signal instanceof AbortSignal);
  });

  it('uses the primary type and filters places that cannot be visited', async () => {
    const client = createGooglePlacesClient({
      apiKey: 'secret-key',
      fetchImpl: async () => new Response(JSON.stringify({
        places: [
          {
            id: 'gas_1',
            displayName: { text: 'Fuel and Food' },
            location: { latitude: 40.1, longitude: -73.9 },
            primaryType: 'gas_station',
            types: ['convenience_store', 'gas_station'],
          },
          {
            id: 'closed_1',
            displayName: { text: 'Closed Cafe' },
            location: { latitude: 40.1, longitude: -73.9 },
            primaryType: 'cafe',
            types: ['cafe'],
            businessStatus: 'CLOSED_PERMANENTLY',
          },
        ],
      }), { status: 200 }),
    });

    const places = await client.searchNearby({ latitude: 40, longitude: -74 });
    assert.equal(places.length, 1);
    assert.equal(places[0].normalizedCategory, 'Gas');
  });

  it('turns timeouts and malformed JSON into safe provider errors', async () => {
    const timedOutClient = createGooglePlacesClient({
      apiKey: 'secret-key',
      timeoutMs: 5,
      fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
    });
    await assert.rejects(
      () => timedOutClient.searchNearby({ latitude: 40, longitude: -74 }),
      (error) => error instanceof PlacesProviderError && error.status === 503
    );

    const malformedClient = createGooglePlacesClient({
      apiKey: 'secret-key',
      fetchImpl: async () => new Response('not-json', { status: 200 }),
    });
    await assert.rejects(
      () => malformedClient.searchNearby({ latitude: 40, longitude: -74 }),
      (error) => error instanceof PlacesProviderError && error.status === 502
    );
  });

  it('surfaces provider failures without leaking the API key', async () => {
    const client = createGooglePlacesClient({
      apiKey: 'secret-key',
      fetchImpl: async () => new Response('quota exceeded', { status: 429 }),
    });
    await assert.rejects(
      () => client.searchNearby({ latitude: 40, longitude: -74 }),
      (error) => error instanceof PlacesProviderError && error.status === 503 && !error.message.includes('secret-key')
    );
  });
});
