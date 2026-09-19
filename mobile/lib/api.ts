import { getAuthToken, clearAllAuth } from "./storage";

// Configurable via EXPO_PUBLIC_API_URL env variable (defaults to active dev environment)
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://lora.quadrox.dev";

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiClient<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { requiresAuth = true, headers: customHeaders, ...fetchOpts } = options;

  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    ...(customHeaders as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await getAuthToken();
    if (token) {
      // Send both Bearer header and Cookie for maximum backend compatibility
      headers["Authorization"] = `Bearer ${token}`;
      headers["Cookie"] = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`;
    }
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    response = await fetch(url, {
      ...fetchOpts,
      headers,
      signal: fetchOpts.signal || controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isOffline =
      !err ||
      err.message?.includes("Network request failed") ||
      err.message?.includes("fetch failed") ||
      err.message?.includes("Failed to fetch") ||
      err.message?.includes("NetworkError") ||
      err.name === "AbortError" ||
      err.message?.includes("aborted");

    const msg = isOffline
      ? "Unable to connect to server. Please check your internet connection and try again."
      : err.message || "Network request failed";
    throw new ApiError(msg, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401 && requiresAuth) {
      await clearAllAuth();
    }
    const message = data?.message || data?.error || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(url: string, options?: FetchOptions) =>
    apiClient<T>(url, { ...options, method: "GET" }),

  post: <T = any>(url: string, body?: any, options?: FetchOptions) =>
    apiClient<T>(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(url: string, body?: any, options?: FetchOptions) =>
    apiClient<T>(url, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(url: string, options?: FetchOptions) =>
    apiClient<T>(url, { ...options, method: "DELETE" }),
};
