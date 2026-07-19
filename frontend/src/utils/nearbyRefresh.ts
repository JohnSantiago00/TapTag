import { getDistance } from "./distance";

export const NEARBY_AUTO_REFRESH_MS = 2 * 60 * 1000;
export const NEARBY_MANUAL_REFRESH_COOLDOWN_MS = 15 * 1000;
export const NEARBY_MOVEMENT_METERS = 75;

export type NearbyLookupLocation = {
  latitude: number;
  longitude: number;
  completedAtMs: number;
};

type NearbyRefreshInput = {
  previous: NearbyLookupLocation | null;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  nowMs: number;
  manual: boolean;
};

export type NearbyRefreshDecision = {
  refresh: boolean;
  reason: "first_lookup" | "manual" | "manual_cooldown" | "moved" | "stale" | "current";
  ageMs: number;
  movementMeters: number;
};

// Keep this policy pure so API cost and location-freshness behavior can be
// tested without mounting the Nearby screen or mocking Expo Location.
export function shouldRefreshNearby({
  previous,
  latitude,
  longitude,
  accuracyMeters,
  nowMs,
  manual,
}: NearbyRefreshInput): NearbyRefreshDecision {
  if (!previous) {
    return { refresh: true, reason: "first_lookup", ageMs: 0, movementMeters: 0 };
  }

  const ageMs = Math.max(0, nowMs - previous.completedAtMs);
  const movementMeters = getDistance(
    previous.latitude,
    previous.longitude,
    latitude,
    longitude
  );

  if (manual) {
    return ageMs < NEARBY_MANUAL_REFRESH_COOLDOWN_MS
      ? { refresh: false, reason: "manual_cooldown", ageMs, movementMeters }
      : { refresh: true, reason: "manual", ageMs, movementMeters };
  }

  const movementThreshold = Math.max(
    NEARBY_MOVEMENT_METERS,
    Number.isFinite(accuracyMeters) ? Number(accuracyMeters) : 0
  );
  if (movementMeters >= movementThreshold) {
    return { refresh: true, reason: "moved", ageMs, movementMeters };
  }
  if (ageMs >= NEARBY_AUTO_REFRESH_MS) {
    return { refresh: true, reason: "stale", ageMs, movementMeters };
  }

  return { refresh: false, reason: "current", ageMs, movementMeters };
}
