import { setAuthTokenGetter } from "@workspace/api-client-react";

const ADMIN_TOKEN_STORAGE_KEY = "scopri-italia-admin-token";

export function getStoredAdminToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim();
  return token ? token : null;
}

export function setStoredAdminToken(token: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token.trim());
}

export function clearStoredAdminToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function configureAdminAuthFromStorage() {
  setAuthTokenGetter(() => getStoredAdminToken());
}
