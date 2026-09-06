import { createFileRoute } from "@tanstack/react-router";
import { Route as AuthedRoute } from "../../_authed";

export const Route = createFileRoute("/_authed/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = AuthedRoute.useRouteContext();

  return (
    <div className="card">
      <h1 className="card-title">Dashboard</h1>
      <p className="my-4 font-normal text-gray-500 dark:text-gray-400">
        You are signed in. Build your app from here.
      </p>

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
          Member since
        </dt>
        <dd className="col-span-3">
          {new Date(user.createdAt).toLocaleDateString()}
        </dd>
      </dl>
    </div>
  );
}
