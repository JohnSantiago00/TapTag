export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authRequired?: boolean;
  timeoutMs?: number;
};

export type ApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getToken?: () => Promise<string | undefined>;
  defaultTimeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export function createApiClient({
  baseUrl,
  fetchImpl = fetch,
  getToken = async () => undefined,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions) {
  async function apiRequest<T>(
    path: string,
    {
      method = "GET",
      body,
      authRequired = false,
      timeoutMs = defaultTimeoutMs,
    }: ApiRequestOptions = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (authRequired) {
      const token = await getToken();
      if (!token) {
        throw new Error("A signed-in user is required for this request.");
      }
      headers.Authorization = `Bearer ${token}`;
    }

    // A request that never settles is worse UX than a clear failure, so every
    // call is capped by an abort timer instead of hanging on a dead server.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error(
          "The TapTag API took too long to respond. Check your connection and try again."
        );
      }
      throw new Error(
        "Could not reach the TapTag API. Check the API server and network URL."
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(await errorMessageFromResponse(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return { apiRequest };
}

async function errorMessageFromResponse(response: Response) {
  const fallback = `TapTag API request failed with ${response.status}.`;

  try {
    const text = await response.text();
    if (!text) return fallback;

    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.message === "string") return parsed.message;
    return text;
  } catch {
    return fallback;
  }
}
