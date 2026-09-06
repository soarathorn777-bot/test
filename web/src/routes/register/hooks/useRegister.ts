import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";
import { api } from "../../../lib/api";
import { acceptAuth, meQueryOptions, type AuthResponse } from "../../../data/auth";

export const useRegister = () => {
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { isPending, error, mutate } = useMutation({
    mutationFn: (input: { email: string; password: string; name?: string }) =>
      api.post<AuthResponse>("/api/auth/register", input),

    onSuccess: (response) => {
      queryClient.setQueryData(meQueryOptions.queryKey, acceptAuth(response));
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    mutate(
      { email, password, ...(name.trim() ? { name: name.trim() } : {}) },
      { onSuccess: () => navigate({ to: "/dashboard" }) },
    );
  };

  return {
    setName,
    setEmail,
    setPassword,
    onSubmit,
    email,
    name,
    password,
    isPending,
    error,
  };
};
