import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { pool, query } = await import("../src/lib/db");
  const { refreshAllEmbeddings } = await import("../src/lib/knowledge");
  const { rebuildGraphProjection } = await import("../src/lib/polygres");

  try {
    const sql = await readFile(resolve(process.cwd(), "sql/003_seed.sql"), "utf8");
    await query(sql);
    await refreshAllEmbeddings();
    await rebuildGraphProjection();
    console.log("seeded knowledge graph");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
