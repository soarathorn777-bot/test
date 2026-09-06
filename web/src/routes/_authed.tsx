import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "../data/auth";

/**
 * Pathless layout route: everything nested under it requires a session.
 * The check runs before the child loaders, so protected pages never flash.
 */
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(meQueryOptions);
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user };
  },
  component: () => <Outlet />,
});
