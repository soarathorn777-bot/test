/**
 * Auth tokens live in localStorage, so they survive a reload and are readable
 * by the fetch wrapper. Every read is guarded: private-mode browsers and
 * blocked site data make `localStorage` throw rather than return null.
 */
const ACCESS_KEY = "auth.accessToken";
const REFRESH_KEY = "auth.refreshToken";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable; the session simply will not survive a reload.
  }
}

export const getAccessToken = () => read(ACCESS_KEY);
export const getRefreshToken = () => read(REFRESH_KEY);

export function setTokens({ accessToken, refreshToken }: AuthTokens) {
  write(ACCESS_KEY, accessToken);
  write(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Nothing to clear.
  }
}
