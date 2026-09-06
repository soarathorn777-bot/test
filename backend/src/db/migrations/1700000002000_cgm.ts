import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("cgm_uploads", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    filename: { type: "text", notNull: true },
    byte_size: { type: "bigint", notNull: true },
    status: { type: "text", notNull: true, default: "processing" },
    error: { type: "text" },
    // Rows the file contained vs. rows this upload actually added: a re-upload
    // of an overlapping export parses everything and inserts only the new tail.
    row_count: { type: "integer", notNull: true, default: 0 },
    inserted_count: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("cgm_uploads", "cgm_uploads_status_check", {
    check: "status IN ('processing', 'ready', 'failed')",
  });

  pgm.createIndex("cgm_uploads", ["user_id", "created_at"]);

  pgm.createTable("cgm_readings", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    upload_id: {
      type: "uuid",
      notNull: true,
      references: "cgm_uploads",
      onDelete: "CASCADE",
    },
    // Denormalised from cgm_uploads so a page of readings is one index scan on
    // one table -- joining just to check ownership would defeat that index.
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    mg_dl: { type: "integer", notNull: true, default: 0 },
    // The device's own wall clock. Stored without a zone: the export carries no
    // offset, and shifting it into the viewer's zone would misreport the night.
    recorded_at: { type: "timestamp", notNull: true },
    // Written by the user, never by the importer -- so a re-upload must not
    // touch it, and neither must anything in the ingest path.
    comment: { type: "text", notNull: true, default: "" },
  });

  // Doubles as the index every paged, time-ordered read scans, and makes
  // re-uploading an overlapping export a no-op rather than a duplicate.
  pgm.addConstraint("cgm_readings", "cgm_readings_user_time_unique", {
    unique: ["user_id", "recorded_at"],
  });

  pgm.createIndex("cgm_readings", "upload_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("cgm_readings");
  pgm.dropTable("cgm_uploads");
}
