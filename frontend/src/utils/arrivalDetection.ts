import { getDistance } from "./distance";

export interface ArrivalPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
}

export interface ArrivalLocation {
  lat: number;
  lon: number;
  timestampMs: number;
}

export interface ArrivalDetectionOptions {
  dwellMs?: number;
  cooldownMs?: number;
}

export interface ArrivalDetectionState {
  dwellStartedAtByPlaceId: Record<string, number>;
  lastArrivalAtByPlaceId: Record<string, number>;
}

export interface ArrivalEvent {
  place: ArrivalPlace;
  distanceMeters: number;
  dwellMs: number;
}

export interface ArrivalDetectionResult {
  state: ArrivalDetectionState;
  arrivals: ArrivalEvent[];
  nearestPlace: {
    place: ArrivalPlace;
    distanceMeters: number;
    isInsideRadius: boolean;
  } | null;
}

const DEFAULT_DWELL_MS = 60_000;
const DEFAULT_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export function createArrivalDetectionState(): ArrivalDetectionState {
  return {
    dwellStartedAtByPlaceId: {},
    lastArrivalAtByPlaceId: {},
  };
}

export function evaluateArrivalDetection(
  places: ArrivalPlace[],
  location: ArrivalLocation,
  previousState: ArrivalDetectionState = createArrivalDetectionState(),
  options: ArrivalDetectionOptions = {}
): ArrivalDetectionResult {
  const dwellMs = options.dwellMs ?? DEFAULT_DWELL_MS;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const dwellStartedAtByPlaceId: Record<string, number> = {};
  const lastArrivalAtByPlaceId = { ...previousState.lastArrivalAtByPlaceId };
  const arrivals: ArrivalEvent[] = [];
  let nearestPlace: ArrivalDetectionResult["nearestPlace"] = null;

  for (const place of places) {
    const distanceMeters = getDistance(
      location.lat,
      location.lon,
      place.lat,
      place.lon
    );
    const isInsideRadius = distanceMeters <= place.radiusMeters;

    if (!nearestPlace || distanceMeters < nearestPlace.distanceMeters) {
      nearestPlace = {
        place,
        distanceMeters,
        isInsideRadius,
      };
    }

    if (!isInsideRadius) {
      continue;
    }

    const lastArrivalAt = lastArrivalAtByPlaceId[place.id];
    const isCoolingDown =
      typeof lastArrivalAt === "number" &&
      location.timestampMs - lastArrivalAt < cooldownMs;

    if (isCoolingDown) {
      continue;
    }

    const dwellStartedAt =
      previousState.dwellStartedAtByPlaceId[place.id] ?? location.timestampMs;
    const elapsedDwellMs = location.timestampMs - dwellStartedAt;
    dwellStartedAtByPlaceId[place.id] = dwellStartedAt;

    if (elapsedDwellMs >= dwellMs) {
      arrivals.push({
        place,
        distanceMeters,
        dwellMs: elapsedDwellMs,
      });
      lastArrivalAtByPlaceId[place.id] = location.timestampMs;
      delete dwellStartedAtByPlaceId[place.id];
    }
  }

  return {
    state: {
      dwellStartedAtByPlaceId,
      lastArrivalAtByPlaceId,
    },
    arrivals,
    nearestPlace,
  };
}
