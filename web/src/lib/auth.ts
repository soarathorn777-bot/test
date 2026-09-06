import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, api } from "./api";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./tokens";

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

/** What `/login`, `/register` and `/refresh` all return. */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** Persist the tokens from an auth response and hand back the user. */
export function acceptAuth(response: AuthResponse): User {
  setTokens(response);
  return response.user;
}

/** Resolves to `null` for anonymous visitors rather than throwing. */
export const meQueryOptions = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async (): Promise<User | null> => {
    // No stored tokens means anonymous; skip the round trip.
    if (!getAccessToken() && !getRefreshToken()) return null;

    try {
      const { user } = await api.get<{ user: User }>("/api/auth/me");
      return user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: 5 * 60 * 1000,
  retry: false,
});

export function useUser() {
  return useQuery(meQueryOptions);
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = getRefreshToken();
      // Tell the server to revoke the session, but sign out locally regardless.
      if (refreshToken) {
        await api.post<void>("/api/auth/logout", { refreshToken }).catch(() => {});
      }
      clearTokens();
    },
    onSuccess: () => {
      queryClient.setQueryData(meQueryOptions.queryKey, null);
      queryClient.clear();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string | null; email?: string }) =>
      api.patch<{ user: User }>("/api/users/me", input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(meQueryOptions.queryKey, user);
    },
  });
}
