import { MigrationBuilder } from "node-pg-migrate";

// The "vector" extension is already created by 1700000000000_init.ts.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("documents", {
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
    byte_size: { type: "integer", notNull: true },
    chunk_count: { type: "integer", notNull: true, default: 0 },
    status: { type: "text", notNull: true, default: "processing" },
    error: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("documents", "documents_status_check", {
    check: "status IN ('processing', 'ready', 'failed')",
  });

  pgm.createIndex("documents", "user_id");

  pgm.createTable("document_chunks", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    document_id: {
      type: "uuid",
      notNull: true,
      references: "documents",
      onDelete: "CASCADE",
    },
    // Denormalised from documents so retrieval filters and orders on a single
    // table -- joining just to check ownership would fight the vector index.
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    chunk_index: { type: "integer", notNull: true },
    content: { type: "text", notNull: true },
    embedding: { type: "vector(1536)", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("document_chunks", "document_id");
  pgm.createIndex("document_chunks", "user_id");

  // Raw SQL: the ANN index needs an operator class, which createIndex cannot express.
  pgm.sql(
    "CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)",
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("document_chunks");
  pgm.dropTable("documents");
}
