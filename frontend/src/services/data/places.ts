import { apiRequest } from "../api";

export interface NearbyMerchant {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  primaryType?: string;
  normalizedCategory: string;
  attributions: {
    provider: string;
    providerUri?: string;
  }[];
  provider: "google_places";
}

export async function getNearbyMerchants(
  latitude: number,
  longitude: number,
  radiusMeters = 300
): Promise<NearbyMerchant[]> {
  const response = await apiRequest<{ places?: unknown }>(
    "/api/users/me/places/nearby",
    {
      method: "POST",
      authRequired: true,
      body: { latitude, longitude, radiusMeters },
      timeoutMs: 12_000,
    }
  );

  if (!Array.isArray(response.places)) return [];
  return response.places.flatMap((value) => {
    const place = value as Partial<NearbyMerchant>;
    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if (
      typeof place.id !== "string" ||
      typeof place.name !== "string" ||
      typeof place.normalizedCategory !== "string" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) return [];

    const attributions = Array.isArray(place.attributions)
      ? place.attributions.flatMap((value) => {
          const attribution = value as { provider?: unknown; providerUri?: unknown };
          if (typeof attribution.provider !== "string" || !attribution.provider.trim()) {
            return [];
          }
          return [{
            provider: attribution.provider.trim(),
            providerUri: typeof attribution.providerUri === "string"
              ? attribution.providerUri
              : undefined,
          }];
        })
      : [];

    return [{
      id: place.id,
      name: place.name,
      address: typeof place.address === "string" ? place.address : undefined,
      latitude: lat,
      longitude: lon,
      primaryType: typeof place.primaryType === "string" ? place.primaryType : undefined,
      normalizedCategory: place.normalizedCategory,
      attributions,
      provider: "google_places" as const,
    }];
  });
}
