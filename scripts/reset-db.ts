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
  const { pool, query } = await import("../src/lib/db");
  const { refreshAllEmbeddings } = await import("../src/lib/knowledge");
  const { getCapabilityStatus } = await import("../src/lib/polygres");

  try {
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'graph') THEN
          PERFORM graph.reset();
        END IF;
      END $$;

      DROP TABLE IF EXISTS capture_inbox CASCADE;
      DROP TABLE IF EXISTS knowledge_edges CASCADE;
      DROP TABLE IF EXISTS knowledge_nodes CASCADE;
      DROP TABLE IF EXISTS app_events CASCADE;
      DROP VIEW IF EXISTS knowledge_product_metrics;
      DROP FUNCTION IF EXISTS cosine_similarity(double precision[], double precision[]);
      DROP FUNCTION IF EXISTS touch_updated_at();
    `);

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
