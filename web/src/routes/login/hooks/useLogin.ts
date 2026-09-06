import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";
import { api } from "../../../lib/api";
import { acceptAuth, meQueryOptions, type AuthResponse } from "../../../lib/auth";

export const useLogin = (redirectTo?: string) => {
  const router = useRouter();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const { mutate, error, isPending } = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<AuthResponse>("/api/auth/login", input),
    onSuccess: (response) => {
      queryClient.setQueryData(meQueryOptions.queryKey, acceptAuth(response));
    },
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    mutate(
      { email, password },
      {
        onSuccess: () => {
          if (redirectTo) router.history.push(redirectTo);
          else navigate({ to: "/dashboard" });
        },
      },
    );
  }

  return { email, setEmail, error, isPending, password, setPassword, onSubmit };
};
