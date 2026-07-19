const GOOGLE_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const DINING_TYPES = new Set([
  'bakery', 'bar', 'cafe', 'coffee_shop', 'fast_food_restaurant',
  'meal_delivery', 'meal_takeaway', 'restaurant',
]);
const GROCERY_TYPES = new Set([
  'grocery_store', 'supermarket', 'food_store', 'market',
]);
const GAS_TYPES = new Set(['gas_station']);
const TRAVEL_TYPES = new Set([
  'airport', 'hotel', 'lodging', 'motel', 'resort_hotel',
]);
const TRANSPORTATION_TYPES = new Set([
  'bus_station', 'parking', 'subway_station', 'taxi_stand',
  'train_station', 'transit_station',
]);
const ENTERTAINMENT_TYPES = new Set([
  'amusement_park', 'aquarium', 'bowling_alley', 'casino',
  'movie_theater', 'museum', 'night_club', 'performing_arts_theater',
  'stadium', 'tourist_attraction', 'zoo',
]);

const SUPPORTED_PLACE_TYPES = [
  ...DINING_TYPES,
  ...GROCERY_TYPES,
  ...GAS_TYPES,
  ...TRAVEL_TYPES,
  ...TRANSPORTATION_TYPES,
  ...ENTERTAINMENT_TYPES,
];

export class PlacesProviderError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'PlacesProviderError';
    this.status = status;
  }
}

export function normalizedCategoryForPlaceTypes(types = []) {
  // Google returns the primary type first from normalizeGooglePlace. Respecting
  // that order avoids classifying a gas station with a convenience store as a
  // grocery store, or a hotel restaurant as Dining instead of Travel.
  for (const type of types) {
    if (DINING_TYPES.has(type)) return 'Dining';
    if (GROCERY_TYPES.has(type)) return 'Groceries';
    if (GAS_TYPES.has(type)) return 'Gas';
    if (TRAVEL_TYPES.has(type)) return 'Travel';
    if (TRANSPORTATION_TYPES.has(type)) return 'Transportation';
    if (ENTERTAINMENT_TYPES.has(type)) return 'Entertainment';
  }
  return 'Other';
}

export function createGooglePlacesClient({ apiKey, fetchImpl = fetch, timeoutMs = 8_000 }) {
  if (!apiKey) return null;

  return {
    async searchNearby({ latitude, longitude, radiusMeters = 250, maxResults = 12 }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;

      try {
        response = await fetchImpl(GOOGLE_NEARBY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.businessStatus,places.attributions',
          },
          signal: controller.signal,
          body: JSON.stringify({
            includedTypes: SUPPORTED_PLACE_TYPES,
            maxResultCount: Math.max(1, Math.min(maxResults, 20)),
            rankPreference: 'DISTANCE',
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius: Math.max(50, Math.min(radiusMeters, 1000)),
              },
            },
          }),
        });
      } catch (error) {
        const message = controller.signal.aborted
          ? 'Places provider request timed out'
          : 'Places provider request failed';
        throw new PlacesProviderError(message, 503);
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const providerBody = await response.text().catch(() => '');
        const status = response.status === 429 ? 503 : 502;
        throw new PlacesProviderError(
          providerBody ? `Places provider error: ${providerBody.slice(0, 240)}` : 'Places provider request failed',
          status
        );
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new PlacesProviderError('Places provider returned an invalid response');
      }

      return (Array.isArray(payload.places) ? payload.places : [])
        .map(normalizeGooglePlace)
        .filter(Boolean);
    },
  };
}

function normalizeGooglePlace(place) {
  const latitude = Number(place?.location?.latitude);
  const longitude = Number(place?.location?.longitude);
  const id = typeof place?.id === 'string' ? place.id : null;
  const name = typeof place?.displayName?.text === 'string' ? place.displayName.text.trim() : '';
  if (
    !id ||
    !name ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    place.businessStatus === 'CLOSED_PERMANENTLY' ||
    place.businessStatus === 'FUTURE_OPENING'
  ) return null;

  const types = Array.isArray(place.types)
    ? place.types.filter((type) => typeof type === 'string').slice(0, 20)
    : [];
  const primaryType = typeof place.primaryType === 'string' ? place.primaryType : undefined;
  const categoryTypes = primaryType
    ? [primaryType, ...types.filter((type) => type !== primaryType)]
    : types;
  const attributions = Array.isArray(place.attributions)
    ? place.attributions.flatMap((attribution) => {
        const provider = typeof attribution?.provider === 'string'
          ? attribution.provider.trim()
          : '';
        if (!provider) return [];
        return [{
          provider,
          providerUri: typeof attribution.providerUri === 'string'
            ? attribution.providerUri
            : undefined,
        }];
      }).slice(0, 10)
    : [];

  return {
    id,
    name,
    address: typeof place.formattedAddress === 'string' ? place.formattedAddress : undefined,
    latitude,
    longitude,
    primaryType,
    normalizedCategory: normalizedCategoryForPlaceTypes(categoryTypes),
    attributions,
    provider: 'google_places',
  };
}
