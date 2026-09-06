import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension("pgcrypto", { ifNotExists: true });
  pgm.createExtension("vector", { ifNotExists: true });

  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    email: { type: "text", notNull: true, unique: true },
    password_hash: { type: "text", notNull: true },
    name: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("users", "email");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("users");
  pgm.dropExtension("vector");
  pgm.dropExtension("pgcrypto");
}
