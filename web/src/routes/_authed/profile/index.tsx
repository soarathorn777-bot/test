import { type SubmitEvent, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ApiError, api } from "../../../lib/api";
import { useUpdateProfile, useUser } from "../../../lib/auth";
import { clearTokens } from "../../../lib/tokens";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authed/profile/")({
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const changePassword = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<void>("/api/users/me/password", input),
    onSuccess: () => {
      // The server revoked every session, so the stored tokens are now dead.
      clearTokens();
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });

  function saveProfile(event: SubmitEvent) {
    event.preventDefault();
    updateProfile.mutate({ name: name.trim() || null, email });
  }

  function savePassword(event: SubmitEvent) {
    event.preventDefault();
    changePassword.mutate({ currentPassword, newPassword });
  }

  return (
    <div className="grid gap-5">
      <form className="card grid gap-3.5" onSubmit={saveProfile}>
        <h1 className="card-title">Profile</h1>

        {updateProfile.error ? (
          <p className="alert">
            {updateProfile.error instanceof ApiError
              ? updateProfile.error.message
              : "Something went wrong"}
          </p>
        ) : null}
        {updateProfile.isSuccess ? (
          <p className="notice">Profile saved.</p>
        ) : null}

        <label className="field">
          Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <button
          className="button"
          type="submit"
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form className="card grid gap-3.5" onSubmit={savePassword}>
        <h2 className="card-subtitle">Change password</h2>
        <p className="my-4 font-normal text-gray-500 dark:text-gray-400">
          Changing your password signs you out everywhere.
        </p>

        {changePassword.error ? (
          <p className="alert">
            {changePassword.error instanceof ApiError
              ? changePassword.error.message
              : "Something went wrong"}
          </p>
        ) : null}

        <label className="field">
          Current password
          <input
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <label className="field">
          New password
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <button
          className="button"
          type="submit"
          disabled={changePassword.isPending}
        >
          {changePassword.isPending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
