import { fetch } from "expo/fetch";
import { getRagApiOrigin } from "./rag-api-origin";

export const getApiBaseUrl = getRagApiOrigin;

type ApiFetchOptions = Readonly<{
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token: string | null;
  body?: unknown;
  signal?: AbortSignal;
}>;

export async function apiFetch<T>(
  path: string,
  { method = "GET", token, body, signal }: ApiFetchOptions,
): Promise<T> {
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return payload as T;
}

type ApiMultipartOptions = Readonly<{
  token: string | null;
  formData: FormData;
}>;

export async function apiMultipartFetch<T>(
  path: string,
  { token, formData }: ApiMultipartOptions,
): Promise<T> {
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? typeof (payload as { error: unknown }).error === "string"
          ? (payload as { error: string }).error
          : typeof (payload as { error: { message?: string } }).error ===
              "object" &&
            (payload as { error: { message?: string } }).error?.message
            ? String((payload as { error: { message?: string } }).error.message)
            : `Request failed (${response.status})`
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return payload as T;
}
