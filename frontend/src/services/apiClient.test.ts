import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApiClient } from "./apiClient";

describe("createApiClient", () => {
  it("adds bearer tokens for protected requests", async () => {
    let capturedAuthorization: string | undefined;
    const client = createApiClient({
      baseUrl: "http://api.test",
      getToken: async () => "token_123",
      fetchImpl: async (_url, init) => {
        capturedAuthorization = (init?.headers as Record<string, string>).Authorization;
        return jsonResponse({ ok: true });
      },
    });

    const result = await client.apiRequest<{ ok: boolean }>("/api/users/me/wallet", {
      authRequired: true,
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(capturedAuthorization, "Bearer token_123");
  });

  it("serializes JSON bodies and returns undefined for 204 responses", async () => {
    let capturedBody: string | undefined;
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: async (_url, init) => {
        capturedBody = init?.body as string | undefined;
        return new Response(null, { status: 204 });
      },
    });

    const result = await client.apiRequest<void>("/api/test", {
      method: "PUT",
      body: { nickname: "Food card" },
    });

    assert.equal(result, undefined);
    assert.equal(capturedBody, JSON.stringify({ nickname: "Food card" }));
  });

  it("throws a clear auth error when no signed-in token is available", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      getToken: async () => undefined,
      fetchImpl: async () => jsonResponse({ ok: true }),
    });

    await assert.rejects(
      () => client.apiRequest("/api/users/me/profile", { authRequired: true }),
      /signed-in user is required/
    );
  });

  it("prefers API error messages from JSON responses", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: async () => jsonResponse({ error: "Invalid bearer token" }, 401),
    });

    await assert.rejects(
      () => client.apiRequest("/api/users/me/profile"),
      /Invalid bearer token/
    );
  });

  it("normalizes network failures", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    await assert.rejects(
      () => client.apiRequest("/health"),
      /Could not reach the TapTag API/
    );
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
