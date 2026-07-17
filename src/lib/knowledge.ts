import type { PoolClient } from "pg";
import { embedText, summarize, toPgVectorLiteral } from "./embedding";
import { query, transaction } from "./db";
import { getCapabilityStatus, rebuildGraphProjection } from "./polygres";
import type {
  AskResponse,
  CaptureInput,
  GraphNode,
  GraphPayload,
  KnowledgeEdge,
  KnowledgeNode,
  NodeType,
  ProductMetrics,
  SearchHit,
} from "./types";

type NodeRow = {
  id: string;
  node_type: NodeType;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  source_url: string | null;
  importance: number;
  sentiment: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type EdgeRow = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  label: string;
  strength: string | number;
  reason: string;
  created_at: Date;
};

const TECH_TERMS = [
  "Polygres",
  "pgGraph",
  "PostgreSQL",
  "Postgres",
  "pgvector",
  "HNSW",
  "RLS",
  "MVCC",
  "ETL",
  "Neo4j",
  "Pinecone",
  "Qdrant",
  "Evokoa",
];

function toNode(row: NodeRow): KnowledgeNode {
  return {
    id: row.id,
    nodeType: row.node_type,
    title: row.title,
    content: row.content,
    summary: row.summary,
    tags: row.tags ?? [],
    sourceUrl: row.source_url,
    importance: Number(row.importance),
    sentiment: row.sentiment,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toEdge(row: EdgeRow): KnowledgeEdge {
  return {
    id: row.id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    label: row.label,
    strength: Number(row.strength),
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
  };
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleFromText(text: string): string {
  const firstLine = text
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Untitled memory";
  }

  const cleaned = firstLine.replace(/^[-*#\s]+/, "").trim();
  if (cleaned.length <= 80) {
    return cleaned;
  }

  const words = cleaned.split(/\s+/).slice(0, 9).join(" ");
  return `${words}...`;
}

function extractTags(text: string, explicitTags: string[] = []): string[] {
  const hashTags = Array.from(text.matchAll(/#([a-zA-Z0-9_-]{2,32})/g)).map(
    (match) => match[1],
  );
  const lowerText = text.toLowerCase();
  const inferred = [
    lowerText.includes("polygres") ? "polygres" : "",
    lowerText.includes("pggraph") ? "pggraph" : "",
    lowerText.includes("vector") || lowerText.includes("embedding")
      ? "semantic-search"
      : "",
    lowerText.includes("agent") ? "agent-memory" : "",
    lowerText.includes("demo") || lowerText.includes("fund")
      ? "fundraising"
      : "",
  ].filter(Boolean);

  return Array.from(
    new Set(
      [...explicitTags, ...hashTags, ...inferred]
        .map((tag) => tag.toLowerCase().trim())
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

function classifyEntity(name: string, context: string): NodeType {
  const lower = `${name} ${context}`.toLowerCase();
  if (
    [
      "polygres",
      "pggraph",
      "postgresql",
      "postgres",
      "pgvector",
      "hnsw",
      "evokoa",
    ].some((term) => lower.includes(term))
  ) {
    return "topic";
  }
  if (
    lower.includes("project") ||
    lower.includes("product") ||
    lower.includes("demo")
  ) {
    return "project";
  }
  if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name)) {
    return "person";
  }
  return "topic";
}

function extractEntities(
  text: string,
): Array<{ title: string; nodeType: NodeType; reason: string }> {
  const explicitTerms = TECH_TERMS.filter((term) =>
    text.toLowerCase().includes(term.toLowerCase()),
  );
  const capitalized = Array.from(
    text.matchAll(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,3}\b/g),
  )
    .map((match) => match[0])
    .filter(
      (value) =>
        value.length > 3 &&
        !["This", "That", "When", "What", "Why", "How"].includes(value),
    );

  const candidates = Array.from(new Set([...explicitTerms, ...capitalized]))
    .map((title) => normalizeTitle(title))
    .filter(Boolean)
    .slice(0, 12);

  return candidates.map((title) => ({
    title,
    nodeType: classifyEntity(title, text),
    reason: `Extracted from capture text as a related ${classifyEntity(title, text)}.`,
  }));
}

async function insertNode(
  client: PoolClient,
  input: {
    nodeType: NodeType;
    title: string;
    content: string;
    summary?: string;
    tags?: string[];
    sourceUrl?: string;
    importance?: number;
    sentiment?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<KnowledgeNode> {
  const embedding = embedText(
    `${input.title}\n${input.summary ?? ""}\n${input.content}\n${(input.tags ?? []).join(" ")}`,
  );
  const status = await getCapabilityStatus();
  const vectorLiteral = toPgVectorLiteral(embedding);

  const result = status.vector.available
    ? await client.query<NodeRow>(
        `
          INSERT INTO knowledge_nodes (
            node_type, title, content, summary, tags, source_url, importance, sentiment, metadata, embedding, embedding_vector
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::double precision[], $11::vector)
          RETURNING *
        `,
        [
          input.nodeType,
          input.title,
          input.content,
          input.summary ?? summarize(input.content),
          input.tags ?? [],
          input.sourceUrl ?? null,
          input.importance ?? 3,
          input.sentiment ?? "neutral",
          JSON.stringify(input.metadata ?? {}),
          embedding,
          vectorLiteral,
        ],
      )
    : await client.query<NodeRow>(
        `
          INSERT INTO knowledge_nodes (
            node_type, title, content, summary, tags, source_url, importance, sentiment, metadata, embedding
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::double precision[])
          RETURNING *
        `,
        [
          input.nodeType,
          input.title,
          input.content,
          input.summary ?? summarize(input.content),
          input.tags ?? [],
          input.sourceUrl ?? null,
          input.importance ?? 3,
          input.sentiment ?? "neutral",
          JSON.stringify(input.metadata ?? {}),
          embedding,
        ],
      );

  return toNode(result.rows[0]);
}

async function upsertEntity(
  client: PoolClient,
  input: { nodeType: NodeType; title: string; content: string; reason: string },
): Promise<KnowledgeNode> {
  const existing = await client.query<NodeRow>(
    `
      SELECT *
      FROM knowledge_nodes
      WHERE node_type = $1
        AND lower(title) = lower($2)
      LIMIT 1
    `,
    [input.nodeType, input.title],
  );

  if (existing.rows[0]) {
    return toNode(existing.rows[0]);
  }

  return insertNode(client, {
    nodeType: input.nodeType,
    title: input.title,
    content: input.content,
    summary: input.content,
    tags: [input.nodeType],
    importance: input.nodeType === "project" ? 4 : 3,
    metadata: { extractionReason: input.reason },
  });
}

async function upsertEdge(
  client: PoolClient,
  input: {
    fromNodeId: string;
    toNodeId: string;
    label: string;
    strength?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (input.fromNodeId === input.toNodeId) {
    return;
  }

  await client.query(
    `
      INSERT INTO knowledge_edges (from_node_id, to_node_id, label, strength, reason, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (from_node_id, to_node_id, label) DO UPDATE
      SET strength = greatest(knowledge_edges.strength, EXCLUDED.strength),
          reason = EXCLUDED.reason,
          metadata = knowledge_edges.metadata || EXCLUDED.metadata
    `,
    [
      input.fromNodeId,
      input.toNodeId,
      input.label,
      input.strength ?? 0.72,
      input.reason ?? "",
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function captureMemory(
  input: CaptureInput,
): Promise<KnowledgeNode> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("Capture text is required.");
  }

  const created = await transaction(async (client) => {
    const title = normalizeTitle(input.title || titleFromText(text));
    const tags = extractTags(text, input.tags);
    const memory = await insertNode(client, {
      nodeType: "memory",
      title,
      content: text,
      summary: summarize(text),
      tags,
      sourceUrl: input.sourceUrl,
      importance: input.importance ?? 3,
      metadata: {
        captureMethod: "manual",
        productLoop: "capture-extract-connect-retrieve",
      },
    });

    await client.query(
      `
        INSERT INTO capture_inbox (raw_text, created_node_id)
        VALUES ($1, $2)
      `,
      [text, memory.id],
    );

    const entities = extractEntities(text);
    for (const entity of entities) {
      const node = await upsertEntity(client, {
        nodeType: entity.nodeType,
        title: entity.title,
        content: `${entity.title} appears in this workspace as a ${entity.nodeType}.`,
        reason: entity.reason,
      });
      await upsertEdge(client, {
        fromNodeId: memory.id,
        toNodeId: node.id,
        label: entity.nodeType === "project" ? "belongs_to" : "mentions",
        strength: 0.78,
        reason: entity.reason,
        metadata: { extracted: true },
      });
    }

    return memory;
  });

  await rebuildGraphProjection().catch(() => undefined);
  return created;
}

export async function refreshAllEmbeddings(): Promise<void> {
  const nodes = await query<NodeRow>("SELECT * FROM knowledge_nodes");
  const status = await getCapabilityStatus();

  for (const row of nodes.rows) {
    const node = toNode(row);
    const embedding = embedText(
      `${node.title}\n${node.summary}\n${node.content}\n${node.tags.join(" ")}`,
    );
    if (status.vector.available) {
      await query(
        `
          UPDATE knowledge_nodes
          SET embedding = $2::double precision[],
              embedding_vector = $3::vector
          WHERE id = $1
        `,
        [node.id, embedding, toPgVectorLiteral(embedding)],
      );
    } else {
      await query(
        "UPDATE knowledge_nodes SET embedding = $2::double precision[] WHERE id = $1",
        [node.id, embedding],
      );
    }
  }
}

export async function getMetrics(): Promise<ProductMetrics> {
  const result = await query<{
    memory_count: string;
    entity_count: string;
    relationship_count: string;
    relationship_types: string;
    captures_this_week: string;
  }>("SELECT * FROM knowledge_product_metrics");

  const row = result.rows[0];
  return {
    memoryCount: Number(row?.memory_count ?? 0),
    entityCount: Number(row?.entity_count ?? 0),
    relationshipCount: Number(row?.relationship_count ?? 0),
    relationshipTypes: Number(row?.relationship_types ?? 0),
    capturesThisWeek: Number(row?.captures_this_week ?? 0),
  };
}

export async function getRecentMemories(limit = 8): Promise<KnowledgeNode[]> {
  const result = await query<NodeRow>(
    `
      SELECT *
      FROM knowledge_nodes
      WHERE node_type = 'memory'
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );
  return result.rows.map(toNode);
}

export async function getImportantNodes(limit = 12): Promise<KnowledgeNode[]> {
  const result = await query<NodeRow>(
    `
      SELECT *
      FROM knowledge_nodes
      ORDER BY importance DESC, created_at DESC
      LIMIT $1
    `,
    [limit],
  );
  return result.rows.map(toNode);
}

export async function searchKnowledge(
  searchText: string,
  limit = 8,
): Promise<SearchHit[]> {
  const q = searchText.trim();
  if (!q) {
    return [];
  }

  const embedding = embedText(q);
  const status = await getCapabilityStatus();
  const params = status.vector.available
    ? [q, toPgVectorLiteral(embedding), limit]
    : [q, embedding, limit];

  const sql = status.vector.available
    ? `
      WITH scored AS (
        SELECT
          *,
          greatest(0, 1 - (embedding_vector <=> $2::vector)) AS vector_score,   -- was $3
          ts_rank_cd(search_vector, plainto_tsquery('english', $1)) AS text_score,
          similarity(title, $1) AS title_score
        FROM knowledge_nodes
        WHERE embedding_vector IS NOT NULL
      )
      SELECT *,
        ((vector_score * 0.58) + (least(text_score, 1) * 0.28) + (title_score * 0.09) + (importance::float / 100)) AS score
      FROM scored
      WHERE vector_score > 0.05
         OR text_score > 0
         OR title_score > 0.08
      ORDER BY score DESC, created_at DESC
      LIMIT $3   -- was $4
    `
    : `
      ... unchanged, still $1/$2/$3
    `;

  const result = await query<
    NodeRow & { vector_score: number; text_score: number; score: number }
  >(sql, params);

  const hits = result.rows.map((row) => ({
    ...toNode(row),
    vectorScore: Number(row.vector_score ?? 0),
    textScore: Number(row.text_score ?? 0),
    graphScore: 0,
    score: Number(row.score ?? 0),
    matchedVia: [
      Number(row.vector_score ?? 0) > 0.08 ? "semantic" : "",
      Number(row.text_score ?? 0) > 0 ? "keyword" : "",
      status.vector.available ? "native-vector" : "local-vector",
    ].filter(Boolean),
  }));

  if (hits[0]) {
    const graph = await getGraph({ focusId: hits[0].id, depth: 1, limit: 24 });
    const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
    return hits.map((hit) => ({
      ...hit,
      graphScore: graphNodeIds.has(hit.id) ? 0.1 : 0,
      score: hit.score + (graphNodeIds.has(hit.id) ? 0.1 : 0),
      matchedVia: graphNodeIds.has(hit.id)
        ? Array.from(new Set([...hit.matchedVia, "graph-neighborhood"]))
        : hit.matchedVia,
    }));
  }

  return hits;
}

async function nativeGraphNodeIds(
  focusId: string,
  depth: number,
  limit: number,
): Promise<Array<{ id: string; depth: number }>> {
  const result = await query<{ node_id: string; depth: number }>(
    `
      SELECT DISTINCT node_id, min(depth) AS depth
      FROM graph.traverse(
        'public.knowledge_nodes'::regclass,
        $1,
        $2,
        hydrate := false,
        max_rows := $3
      )
      GROUP BY node_id
      ORDER BY min(depth), node_id
    `,
    [focusId, depth, limit],
  );

  return result.rows.map((row) => ({
    id: row.node_id,
    depth: Number(row.depth),
  }));
}

async function fallbackGraphNodeIds(
  focusId: string,
  depth: number,
  limit: number,
): Promise<Array<{ id: string; depth: number }>> {
  const result = await query<{ id: string; depth: number }>(
    `
      WITH RECURSIVE walk(id, depth, path) AS (
        SELECT $1::text, 0, ARRAY[$1::text]
        UNION ALL
        SELECT
          CASE WHEN e.from_node_id = walk.id THEN e.to_node_id ELSE e.from_node_id END,
          walk.depth + 1,
          path || CASE WHEN e.from_node_id = walk.id THEN e.to_node_id ELSE e.from_node_id END
        FROM walk
        JOIN knowledge_edges e
          ON e.from_node_id = walk.id
          OR e.to_node_id = walk.id
        WHERE walk.depth < $2
          AND NOT (
            CASE WHEN e.from_node_id = walk.id THEN e.to_node_id ELSE e.from_node_id END
          ) = ANY(path)
      )
      SELECT id, min(depth) AS depth
      FROM walk
      GROUP BY id
      ORDER BY min(depth), id
      LIMIT $3
    `,
    [focusId, depth, limit],
  );

  return result.rows.map((row) => ({ id: row.id, depth: Number(row.depth) }));
}

export async function getGraph(
  options: { focusId?: string; depth?: number; limit?: number } = {},
): Promise<GraphPayload> {
  const depth = options.depth ?? 2;
  const limit = options.limit ?? 36;
  const status = await getCapabilityStatus();

  let nodeDepths: Array<{ id: string; depth: number }> = [];

  if (options.focusId) {
    if (status.pgGraph.available) {
      try {
        nodeDepths = await nativeGraphNodeIds(options.focusId, depth, limit);
      } catch {
        nodeDepths = await fallbackGraphNodeIds(options.focusId, depth, limit);
      }
    } else {
      nodeDepths = await fallbackGraphNodeIds(options.focusId, depth, limit);
    }
  } else {
    const result = await query<{ id: string; depth: number }>(
      `
        SELECT id, 0 AS depth
        FROM knowledge_nodes
        ORDER BY importance DESC, created_at DESC
        LIMIT $1
      `,
      [limit],
    );
    nodeDepths = result.rows.map((row) => ({
      id: row.id,
      depth: Number(row.depth),
    }));
  }

  if (nodeDepths.length === 0) {
    return { nodes: [], edges: [], focusId: options.focusId };
  }

  const ids = nodeDepths.map((node) => node.id);
  const depthById = new Map(nodeDepths.map((node) => [node.id, node.depth]));
  const nodeResult = await query<NodeRow>(
    `
      SELECT *
      FROM knowledge_nodes
      WHERE id = ANY($1::text[])
      ORDER BY importance DESC, created_at DESC
    `,
    [ids],
  );

  const edgeResult = await query<EdgeRow>(
    `
      SELECT *
      FROM knowledge_edges
      WHERE from_node_id = ANY($1::text[])
        AND to_node_id = ANY($1::text[])
      ORDER BY strength DESC, created_at DESC
    `,
    [ids],
  );

  const nodes = layoutGraph(
    nodeResult.rows.map((row) => ({
      ...toNode(row),
      depth: depthById.get(row.id) ?? 0,
    })),
    edgeResult.rows.map(toEdge),
    options.focusId,
  );

  return {
    nodes,
    edges: edgeResult.rows.map(toEdge),
    focusId: options.focusId,
  };
}

function layoutGraph(
  nodes: GraphNode[],
  edges: KnowledgeEdge[],
  focusId?: string,
): GraphNode[] {
  const center = { x: 440, y: 290 };
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const focusIndex = focusId
    ? nodes.findIndex((node) => node.id === focusId)
    : -1;
  const ordered = [...nodes];
  if (focusIndex > 0) {
    const [focus] = ordered.splice(focusIndex, 1);
    ordered.unshift(focus);
  }

  const degree = new Map<string, number>();
  edges.forEach((edge) => {
    degree.set(edge.fromNodeId, (degree.get(edge.fromNodeId) ?? 0) + 1);
    degree.set(edge.toNodeId, (degree.get(edge.toNodeId) ?? 0) + 1);
  });

  const nonFocusNodes = ordered.filter(
    (node, index) => !(node.id === focusId || (!focusId && index === 0)),
  );

  return ordered.map((node, index) => {
    if (node.id === focusId || (!focusId && index === 0)) {
      return { ...node, x: center.x, y: center.y };
    }

    const depth = Math.max(1, node.depth ?? 1);
    const ringIndex = Math.max(
      0,
      nonFocusNodes.findIndex((candidate) => candidate.id === node.id),
    );
    const ringTotal = Math.max(1, nonFocusNodes.length);
    const angle =
      (Math.PI * 2 * ringIndex) / ringTotal - Math.PI / 2 + depth * 0.22;
    const radius = Math.min(
      280,
      145 + depth * 72 + Math.min(24, (degree.get(node.id) ?? 0) * 4),
    );

    return {
      ...node,
      x: clamp(Math.round(center.x + Math.cos(angle) * radius), 70, 810),
      y: clamp(Math.round(center.y + Math.sin(angle) * radius), 70, 510),
    };
  });
}

export async function askSynapse(question: string): Promise<AskResponse> {
  const evidence = await searchKnowledge(question, 6);
  const graph = evidence[0]
    ? await getGraph({ focusId: evidence[0].id, depth: 2, limit: 28 })
    : await getGraph();

  if (evidence.length === 0) {
    return {
      answer:
        "I do not have enough connected memory yet to answer that with evidence. Capture a few notes about the people, projects, or decisions involved, then ask again.",
      evidence,
      graph,
    };
  }

  const strongest = evidence[0];
  const related = graph.nodes
    .filter((node) => node.id !== strongest.id)
    .slice(0, 4)
    .map((node) => node.title);

  const answer = [
    `The strongest signal in Synapse is "${strongest.title}".`,
    strongest.summary || summarize(strongest.content, 180),
    related.length
      ? `The graph connects this to ${related.join(", ")}, so I would treat those as the next pieces of context to inspect.`
      : "There are not many graph neighbors yet, so the answer is mostly coming from semantic memory.",
    `Confidence is based on ${strongest.matchedVia.join(", ")} retrieval with a score of ${strongest.score.toFixed(2)}.`,
  ].join(" ");

  return {
    answer,
    evidence,
    graph,
  };
}
