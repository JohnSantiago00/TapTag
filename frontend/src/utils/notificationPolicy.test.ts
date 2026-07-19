import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldPresentPaymentNotification } from "./notificationPolicy";

describe("payment notification presentation policy", () => {
  it("suppresses banners while TapTag is active", () => {
    assert.equal(shouldPresentPaymentNotification("active"), false);
  });

  it("allows notifications while backgrounded or inactive", () => {
    assert.equal(shouldPresentPaymentNotification("background"), true);
    assert.equal(shouldPresentPaymentNotification("inactive"), true);
    assert.equal(shouldPresentPaymentNotification(null), true);
  });
});
