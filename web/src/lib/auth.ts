import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, api } from "./api";
import { clearToken, getToken, setToken } from "./tokens";

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/** Persist the token from an auth response and hand back the user. */
export function acceptAuth({ user, token }: AuthResponse): User {
  setToken(token);
  return user;
}

/** Resolves to `null` for anonymous visitors rather than throwing. */
export const meQueryOptions = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async (): Promise<User | null> => {
    if (!getToken()) return null;

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
      // `/logout` needs the bearer token, but signing out locally is what
      // actually ends the session — the JWT is stateless server-side.
      if (getToken()) {
        await api.post<{ message: string }>("/api/auth/logout").catch(() => {});
      }
      clearToken();
    },
    onSuccess: () => {
      queryClient.setQueryData(meQueryOptions.queryKey, null);
      queryClient.clear();
    },
  });
}
