import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ApiError } from "../../lib/api";
import { meQueryOptions } from "../../data/auth";
import { useRegister } from "./hooks/useRegister";

export const RegisterPage = () => {
  const {
    onSubmit,
    setName,
    setEmail,
    setPassword,
    email,
    name,
    password,
    error,
    isPending,
  } = useRegister();

  return (
    <form className="card grid gap-3.5" onSubmit={onSubmit}>
      <h1 className="card-title">Create account</h1>

      {error ? (
        <p className="alert">
          {error instanceof ApiError ? error.message : "Something went wrong"}
        </p>
      ) : null}

      <label className="field">
        Name{" "}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          (optional)
        </span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </label>

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
          autoComplete="new-password"
          minLength={8}
          required
        />
        <small className="text-xs font-normal text-gray-500 dark:text-gray-400">
          At least 8 characters.
        </small>
      </label>

      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create account"}
      </button>

      <p className="my-4 font-normal text-gray-500 dark:text-gray-400">
        Already registered?{" "}
        <Link
          to="/login"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
};

export const Route = createFileRoute("/register/")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query(meQueryOptions);
    if (user) throw redirect({ to: "/dashboard" });
  },
  component: RegisterPage,
});
