import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Route as AuthedRoute } from "../../_authed";
import { useLogout } from "../../../lib/auth";

export const Route = createFileRoute("/_authed/profile/")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = AuthedRoute.useRouteContext();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="grid gap-5">
      <div className="card">
        <h1 className="card-title">Profile</h1>

        <dl className="mt-4 grid grid-cols-4 gap-x-4 gap-y-2">
          <dt className="text-sm font-normal text-gray-500 dark:text-gray-400">
            Name
          </dt>
          <dd className="col-span-3">
            {user.name ?? (
              <span className="font-normal text-gray-500 dark:text-gray-400">
                not set
              </span>
            )}
          </dd>
          <dt className="text-sm font-normal text-gray-500 dark:text-gray-400">
            Email
          </dt>
          <dd className="col-span-3">{user.email}</dd>
          <dt className="text-sm font-normal text-gray-500 dark:text-gray-400">
            User ID
          </dt>
          <dd className="col-span-3 font-mono text-sm break-all">{user.id}</dd>
          <dt className="text-sm font-normal text-gray-500 dark:text-gray-400">
            Member since
          </dt>
          <dd className="col-span-3">
            {new Date(user.createdAt).toLocaleDateString()}
          </dd>
        </dl>
      </div>

      <div className="card grid gap-3.5">
        <h2 className="card-subtitle">Session</h2>
        <p className="my-2 font-normal text-gray-500 dark:text-gray-400">
          Signing out clears the token stored in this browser.
        </p>
        <button
          className="button"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => navigate({ to: "/login" }),
            })
          }
        >
          {logout.isPending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
