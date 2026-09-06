import type { QueryClient } from '@tanstack/react-query';
import { Link, Outlet, createRootRouteWithContext, useNavigate } from '@tanstack/react-router';
import { useLogout, useUser } from '../data/auth';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="card">
      <h1 className="card-title">404</h1>
      <p className="my-4 font-normal text-gray-500 dark:text-gray-400">That page does not exist.</p>
      <Link to="/" className="button">
        Go home
      </Link>
    </div>
  ),
});

function RootLayout() {
  const { data: user, isPending } = useUser();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <Link
          to="/"
          className="font-bold tracking-widest text-gray-900 hover:underline dark:text-gray-200"
        >
          TR
        </Link>

        <nav className="ml-auto flex items-center gap-4">
          {isPending ? null : user ? (
            <>
              <Link to="/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">
                Dashboard
              </Link>
              <Link to="/chat" className="text-blue-600 hover:underline dark:text-blue-400">
                Chat
              </Link>
              <Link to="/profile" className="text-blue-600 hover:underline dark:text-blue-400">
                Profile
              </Link>
              <span className="font-normal text-gray-500 dark:text-gray-400">{user.email}</span>
              <button
                className="button-ghost"
                disabled={logout.isPending}
                onClick={() =>
                  logout.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })
                }
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                Sign in
              </Link>
              <Link to="/register" className="button">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
