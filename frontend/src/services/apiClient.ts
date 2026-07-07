export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authRequired?: boolean;
};

export type ApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getToken?: () => Promise<string | undefined>;
};

export function createApiClient({
  baseUrl,
  fetchImpl = fetch,
  getToken = async () => undefined,
}: ApiClientOptions) {
  async function apiRequest<T>(
    path: string,
    { method = "GET", body, authRequired = false }: ApiRequestOptions = {}
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

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error("Could not reach the TapTag API. Check the API server and network URL.");
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
