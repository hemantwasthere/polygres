import { SynapseApp } from "@/components/SynapseApp";
import { getGraph, getImportantNodes, getMetrics, getRecentMemories } from "@/lib/knowledge";
import { getCapabilityStatus } from "@/lib/polygres";

export const dynamic = "force-dynamic";

async function loadDashboard() {
  try {
    const [metrics, status, recentMemories, graph, importantNodes] = await Promise.all([
      getMetrics(),
      getCapabilityStatus(),
      getRecentMemories(8),
      getGraph({ limit: 34 }),
      getImportantNodes(12)
    ]);

    return {
      metrics,
      status,
      recentMemories,
      graph,
      importantNodes,
      error: null
    };
  } catch (error) {
    return {
      metrics: {
        memoryCount: 0,
        entityCount: 0,
        relationshipCount: 0,
        relationshipTypes: 0,
        capturesThisWeek: 0
      },
      status: {
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
        pgGraph: { available: false, mode: "recursive_sql_fallback" as const, error: "Database is not initialized." },
        vector: { available: false, mode: "float8_cosine_fallback" as const, indexed: false }
      },
      recentMemories: [],
      graph: { nodes: [], edges: [] },
      importantNodes: [],
      error: error instanceof Error ? error.message : "Unable to load the workspace."
    };
  }
}

export default async function Home() {
  const data = await loadDashboard();
  return <SynapseApp initialData={data} />;
}
