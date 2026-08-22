import { ensureSchema } from "../api/bootstrap";

async function seed() {
  console.log("[GelombangMaya] Seeding database...");
  await ensureSchema();
  console.log("[GelombangMaya] Database schema and default detection rules initialized.");
  process.exit(0);
}

seed();
