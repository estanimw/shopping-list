import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

let database: Database.Database | undefined;

const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'FINISHED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'DELETED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    deleted_at TEXT
  );

  CREATE INDEX IF NOT EXISTS shopping_items_active_list_idx
    ON shopping_items (list_id, status, created_at DESC);

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

  return database;
}
