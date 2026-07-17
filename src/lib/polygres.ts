import { query } from "./db";
import type { CapabilityStatus } from "./types";

type GraphStatusRow = {
  node_count: number;
  edge_count: number;
};

export async function getCapabilityStatus(): Promise<CapabilityStatus> {
  const extensionResult = await query<{
    graph_available: boolean;
    vector_available: boolean;
    vector_column: boolean;
    vector_indexed: boolean;
  }>(`
    SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'graph') AS graph_available,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_available,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_nodes'
          AND column_name = 'embedding_vector'
      ) AS vector_column,
      EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'knowledge_nodes'
          AND indexname = 'idx_knowledge_nodes_embedding_hnsw'
      ) AS vector_indexed
  `);

  const base = extensionResult.rows[0];
  const status: CapabilityStatus = {
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    pgGraph: {
      available: base.graph_available,
      mode: base.graph_available ? "native" : "recursive_sql_fallback"
    },
    vector: {
      available: base.vector_available && base.vector_column,
      indexed: base.vector_indexed,
      mode: base.vector_available && base.vector_column ? "pgvector_hnsw" : "float8_cosine_fallback"
    }
  };

  if (base.graph_available) {
    try {
      const graphStatus = await query<GraphStatusRow>("SELECT node_count, edge_count FROM graph.status()");
      status.pgGraph.nodeCount = graphStatus.rows[0]?.node_count;
      status.pgGraph.edgeCount = graphStatus.rows[0]?.edge_count;
    } catch (error) {
      status.pgGraph.error = error instanceof Error ? error.message : "Unable to read graph.status().";
    }
  }

  return status;
}

export async function rebuildGraphProjection(): Promise<void> {
  const status = await getCapabilityStatus();
  if (!status.pgGraph.available) {
    return;
  }

  await query("SELECT graph.build()");
}
