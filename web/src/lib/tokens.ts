/**
 * The backend issues a single JWT (no refresh token), so one key is enough.
 * Every access is guarded: private-mode browsers and blocked site data make
 * `localStorage` throw rather than return null.
 */
const TOKEN_KEY = "auth.token";

export const getToken = (): string | null => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string) => {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable; the session simply will not survive a reload.
  }
};

export const clearToken = () => {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
};
