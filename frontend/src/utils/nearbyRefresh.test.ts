import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NEARBY_AUTO_REFRESH_MS,
  NEARBY_MANUAL_REFRESH_COOLDOWN_MS,
  shouldRefreshNearby,
} from "./nearbyRefresh";

const previous = {
  latitude: 40.758,
  longitude: -73.9855,
  completedAtMs: 1_000_000,
};

describe("shouldRefreshNearby", () => {
  it("refreshes the first lookup", () => {
    assert.equal(shouldRefreshNearby({
      previous: null,
      latitude: 40.758,
      longitude: -73.9855,
      nowMs: 1_000_000,
      manual: false,
    }).reason, "first_lookup");
  });

  it("reuses a recent result when the user has not moved meaningfully", () => {
    const decision = shouldRefreshNearby({
      previous,
      latitude: 40.7581,
      longitude: -73.9855,
      accuracyMeters: 20,
      nowMs: previous.completedAtMs + 30_000,
      manual: false,
    });
    assert.equal(decision.refresh, false);
    assert.equal(decision.reason, "current");
  });

  it("refreshes after movement or staleness", () => {
    assert.equal(shouldRefreshNearby({
      previous,
      latitude: 40.759,
      longitude: -73.9855,
      accuracyMeters: 20,
      nowMs: previous.completedAtMs + 30_000,
      manual: false,
    }).reason, "moved");

    assert.equal(shouldRefreshNearby({
      previous,
      latitude: previous.latitude,
      longitude: previous.longitude,
      nowMs: previous.completedAtMs + NEARBY_AUTO_REFRESH_MS,
      manual: false,
    }).reason, "stale");
  });

  it("prevents rapid manual refreshes but allows a later one", () => {
    assert.equal(shouldRefreshNearby({
      previous,
      latitude: previous.latitude,
      longitude: previous.longitude,
      nowMs: previous.completedAtMs + NEARBY_MANUAL_REFRESH_COOLDOWN_MS - 1,
      manual: true,
    }).reason, "manual_cooldown");

    assert.equal(shouldRefreshNearby({
      previous,
      latitude: previous.latitude,
      longitude: previous.longitude,
      nowMs: previous.completedAtMs + NEARBY_MANUAL_REFRESH_COOLDOWN_MS,
      manual: true,
    }).reason, "manual");
  });
});
