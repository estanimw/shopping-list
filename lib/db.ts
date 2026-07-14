import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

let database: Database.Database | undefined;

const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_id TEXT NOT NULL UNIQUE,
    user_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'FINISHED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    last_mutation_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_mutation_operation_id TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_id TEXT NOT NULL UNIQUE,
    list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'DELETED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    deleted_at TEXT,
    last_mutation_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_mutation_operation_id TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS shopping_items_active_list_idx
    ON shopping_items (list_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS sync_operation_receipts (
    operation_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS sync_operation_receipts_user_idx
    ON sync_operation_receipts (user_id, processed_at DESC);

  CREATE TABLE IF NOT EXISTS "user" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    expiresAt DATE NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS account (
    id TEXT NOT NULL PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt DATE,
    refreshTokenExpiresAt DATE,
    scope TEXT,
    password TEXT,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT NOT NULL PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt DATE NOT NULL,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL
  );

  CREATE INDEX IF NOT EXISTS session_userId_idx ON session (userId);
  CREATE INDEX IF NOT EXISTS account_userId_idx ON account (userId);
  CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification (identifier);
`;

function getDatabasePath() {
  return process.env.DB_PATH ?? join(process.cwd(), "data", "shopping.db");
}

function migrateShoppingLists(database: Database.Database) {
  const columns = database
    .prepare("PRAGMA table_info(shopping_lists)")
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === "user_id")) {
    database.exec("DROP INDEX IF EXISTS only_one_active_shopping_list");
    database.exec("ALTER TABLE shopping_lists ADD COLUMN user_id TEXT");
  }

  database.exec(`
    DROP INDEX IF EXISTS only_one_active_shopping_list;
    CREATE UNIQUE INDEX IF NOT EXISTS only_one_active_shopping_list_per_user
      ON shopping_lists (user_id)
      WHERE status = 'ACTIVE';
    CREATE INDEX IF NOT EXISTS shopping_lists_user_status_idx
      ON shopping_lists (user_id, status, created_at DESC);
  `);
}

function columnNames(database: Database.Database, table: string) {
  return database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
}

function addColumnIfMissing(
  database: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  if (!columnNames(database, table).some((entry) => entry.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateOfflineSynchronization(database: Database.Database) {
  addColumnIfMissing(database, "shopping_lists", "sync_id", "TEXT");
  addColumnIfMissing(database, "shopping_lists", "last_mutation_at", "TEXT");
  addColumnIfMissing(
    database,
    "shopping_lists",
    "last_mutation_operation_id",
    "TEXT NOT NULL DEFAULT ''",
  );
  addColumnIfMissing(database, "shopping_items", "sync_id", "TEXT");
  addColumnIfMissing(database, "shopping_items", "last_mutation_at", "TEXT");
  addColumnIfMissing(
    database,
    "shopping_items",
    "last_mutation_operation_id",
    "TEXT NOT NULL DEFAULT ''",
  );

  const backfillIds = (table: "shopping_lists" | "shopping_items") => {
    const rows = database.prepare(`SELECT id FROM ${table} WHERE sync_id IS NULL`).all() as Array<{
      id: number;
    }>;
    const update = database.prepare(`UPDATE ${table} SET sync_id = ? WHERE id = ?`);
    for (const row of rows) {
      update.run(randomUUID(), row.id);
    }
  };

  backfillIds("shopping_lists");
  backfillIds("shopping_items");
  database.exec(`
    UPDATE shopping_lists
    SET last_mutation_at = COALESCE(last_mutation_at, finished_at, created_at, CURRENT_TIMESTAMP);
    UPDATE shopping_items
    SET last_mutation_at = COALESCE(last_mutation_at, deleted_at, completed_at, created_at, CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS shopping_lists_sync_id_idx ON shopping_lists (sync_id);
    CREATE UNIQUE INDEX IF NOT EXISTS shopping_items_sync_id_idx ON shopping_items (sync_id);
  `);
}

export function getDatabase() {
  if (database) {
    return database;
  }

  const databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });

  database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(schema);
  migrateShoppingLists(database);
  migrateOfflineSynchronization(database);

  return database;
}
