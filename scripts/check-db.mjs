import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const databasePath = resolve(process.env.DB_PATH || "data/shopping.db");

if (!existsSync(databasePath)) {
  console.error(`No existe una base en ${databasePath}. Abrí la app una vez para crearla.`);
  process.exit(1);
}

const database = new Database(databasePath, { readonly: true });
const tables = database
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((row) => row.name);

if (!tables.includes("shopping_lists") || !tables.includes("shopping_items")) {
  console.error("La base no tiene el esquema esperado.");
  process.exit(1);
}

console.log(`SQLite verificado: ${databasePath}`);
