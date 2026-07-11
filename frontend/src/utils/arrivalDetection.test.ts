import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createArrivalDetectionState,
  evaluateArrivalDetection,
  type ArrivalPlace,
} from "./arrivalDetection";

const place: ArrivalPlace = {
  id: "trader-joes",
  name: "Trader Joe's",
  lat: 37.789,
  lon: -122.401,
  radiusMeters: 120,
};

describe("evaluateArrivalDetection", () => {
  it("waits for dwell time before firing an arrival", () => {
    const first = evaluateArrivalDetection(
      [place],
      { lat: place.lat, lon: place.lon, timestampMs: 1_000 },
      createArrivalDetectionState(),
      { dwellMs: 45_000 }
    );
    const second = evaluateArrivalDetection(
      [place],
      { lat: place.lat, lon: place.lon, timestampMs: 46_000 },
      first.state,
      { dwellMs: 45_000 }
    );

    assert.equal(first.arrivals.length, 0);
    assert.equal(second.arrivals.length, 1);
    assert.equal(second.arrivals[0].place.id, place.id);
  });

  it("keeps per-place cooldown after an arrival", () => {
    const arrived = evaluateArrivalDetection(
      [place],
      { lat: place.lat, lon: place.lon, timestampMs: 61_000 },
      {
        dwellStartedAtByPlaceId: { [place.id]: 1_000 },
        lastArrivalAtByPlaceId: {},
      },
      { dwellMs: 45_000, cooldownMs: 120_000 }
    );
    const coolingDown = evaluateArrivalDetection(
      [place],
      { lat: place.lat, lon: place.lon, timestampMs: 90_000 },
      arrived.state,
      { dwellMs: 45_000, cooldownMs: 120_000 }
    );

    assert.equal(arrived.arrivals.length, 1);
    assert.equal(coolingDown.arrivals.length, 0);
  });

  it("resets dwell when the user leaves the radius", () => {
    const inside = evaluateArrivalDetection(
      [place],
      { lat: place.lat, lon: place.lon, timestampMs: 1_000 },
      createArrivalDetectionState(),
      { dwellMs: 45_000 }
    );
    const outside = evaluateArrivalDetection(
      [place],
      { lat: place.lat + 0.1, lon: place.lon, timestampMs: 20_000 },
      inside.state,
      { dwellMs: 45_000 }
    );
    const returned = evaluateArrivalDetection(
      [place],
      { lat: place.lat, lon: place.lon, timestampMs: 30_000 },
      outside.state,
      { dwellMs: 45_000 }
    );

    assert.equal(outside.state.dwellStartedAtByPlaceId[place.id], undefined);
    assert.equal(returned.arrivals.length, 0);
    assert.equal(returned.state.dwellStartedAtByPlaceId[place.id], 30_000);
  });
});
