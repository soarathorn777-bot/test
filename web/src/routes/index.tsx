import { Link, createFileRoute } from '@tanstack/react-router';
import { useUser } from '../lib/auth';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { data: user } = useUser();

  return (
    <div className="card">
      <h1 className="card-title">TanStack + Express + Prisma</h1>
      <p className="my-4 font-normal text-gray-500 dark:text-gray-400">
        A minimal full-stack starter with bearer-token JWT auth, rotating refresh sessions, and a
        Postgres-backed user model.
      </p>

      {user ? (
        <Link to="/dashboard" className="button">
          Go to dashboard
        </Link>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link to="/register" className="button">
            Create an account
          </Link>
          <Link to="/login" className="button-ghost">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
