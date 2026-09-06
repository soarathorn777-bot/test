import { HttpError } from "../middleware/error.middleware";
import { LoginInput, RegisterInput } from "../schemas/auth.schemas";
import { comparePassword, hashPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { createUser, findUserByEmail, toPublicUser } from "./user.service";

export async function register(input: RegisterInput) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({ email: input.email, passwordHash, name: input.name });
  const token = signToken({ userId: user.id, email: user.email });

  return { user: toPublicUser(user), token };
}

export async function login(input: LoginInput) {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const valid = await comparePassword(input.password, user.password_hash);
  if (!valid) {
    throw new HttpError(401, "Invalid email or password");
  }

  const token = signToken({ userId: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}
