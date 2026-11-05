import { defineConfig } from "drizzle-kit";

import { readConfig } from "./config";

const { databaseUrl } = readConfig("database");

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  breakpoints: true,
  verbose: true,
  strict: true,
});
