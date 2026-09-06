import { pool } from "../db/pool";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query<User>("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function createUser(params: { email: string; passwordHash: string; name?: string }): Promise<User> {
  const result = await pool.query<User>(
    "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *",
    [params.email, params.passwordHash, params.name ?? null],
  );
  return result.rows[0];
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.created_at,
  };
}
