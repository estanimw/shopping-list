import { cpSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const root = process.cwd();
const standaloneDirectory = join(root, ".next", "standalone");
const serverPath = join(standaloneDirectory, "server.js");

if (!existsSync(serverPath)) {
  throw new Error("No encontramos el build de producción. Ejecutá npm run build antes de npm run start.");
}

// Next standalone no incluye public automáticamente; sin esta copia faltan el manifest y el service worker.
cpSync(join(root, "public"), join(standaloneDirectory, "public"), { recursive: true, force: true });

await import(pathToFileURL(serverPath).href);
