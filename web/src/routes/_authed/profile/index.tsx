import { createFileRoute } from "@tanstack/react-router";
import { useUser } from "../../../data/auth";

const ProfilePage = () => {
  const { data: user } = useUser();

  if (!user) return;

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
    </div>
  );
};

export const Route = createFileRoute("/_authed/profile/")({
  component: ProfilePage,
});
