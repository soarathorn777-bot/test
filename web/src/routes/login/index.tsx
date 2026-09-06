import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ApiError } from "../../lib/api";
import { meQueryOptions } from "../../lib/auth";
import { useLogin } from "./hooks/useLogin";

const LoginPage = () => {
  const { redirect: redirectTo } = Route.useSearch();
  const { onSubmit, error, email, setEmail, setPassword, password, isPending } =
    useLogin(redirectTo);

  return (
    <form className="card grid gap-3.5" onSubmit={onSubmit}>
      <h1 className="card-title">Sign in</h1>

      {error ? (
        <p className="alert">
          {error instanceof ApiError ? error.message : "Something went wrong"}
        </p>
      ) : null}

      <label className="field">
        Email
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className="field">
        Password
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </button>

      <p className="my-4 font-normal text-gray-500 dark:text-gray-400">
        No account?{" "}
        <Link
          to="/register"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Create one
        </Link>
      </p>
    </form>
  );
};

export const Route = createFileRoute("/login/")({
  // The optional property (rather than `string | undefined`) keeps `search`
  // optional on every <Link to="/login">.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query(meQueryOptions);
    if (user) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});
