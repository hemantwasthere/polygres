import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function runSqlFile(file: string) {
  const { query } = await import("../src/lib/db");
  const sql = await readFile(resolve(process.cwd(), file), "utf8");
  await query(sql);
  console.log(`applied ${file}`);
}

async function main() {
  const { pool } = await import("../src/lib/db");
  const { refreshAllEmbeddings } = await import("../src/lib/knowledge");
  const { getCapabilityStatus } = await import("../src/lib/polygres");

  try {
    await runSqlFile("sql/001_schema.sql");
    await runSqlFile("sql/003_seed.sql");
    await refreshAllEmbeddings();
    await runSqlFile("sql/002_polygres_graph.sql");

    const status = await getCapabilityStatus();
    console.log(
      JSON.stringify(
        {
          pgGraph: status.pgGraph.mode,
          vector: status.vector.mode,
          hnsw: status.vector.indexed
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
