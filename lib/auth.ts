import { betterAuth } from "better-auth";
import { getDatabase } from "@/lib/db";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.BETTER_AUTH_SECRET &&
  !isProductionBuild
) {
  throw new Error("Falta BETTER_AUTH_SECRET para iniciar las cuentas en producción.");
}

export const auth = betterAuth({
  baseURL,
  database: getDatabase(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "compra-ligera-desarrollo-local-no-usar-en-produccion",
  trustedOrigins: [baseURL],
});
