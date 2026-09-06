import type { User } from '@prisma/client';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

/** Never let `passwordHash` leave the server. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}
