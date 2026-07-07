import { auth } from "../config/firebase";
import { createApiClient, ApiRequestOptions } from "./apiClient";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_TAPTAG_API_BASE_URL || "http://localhost:4000";

const client = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => auth.currentUser?.getIdToken(),
});

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  return client.apiRequest<T>(path, options);
}
