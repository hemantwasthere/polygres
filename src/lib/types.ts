export type NodeType =
  | "memory"
  | "person"
  | "project"
  | "topic"
  | "source"
  | "claim"
  | "question";

export type KnowledgeNode = {
  id: string;
  nodeType: NodeType;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  sourceUrl: string | null;
  importance: number;
  sentiment: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  strength: number;
  reason: string;
  createdAt: string;
};

export type SearchHit = KnowledgeNode & {
  vectorScore: number;
  textScore: number;
  graphScore: number;
  score: number;
  matchedVia: string[];
};

export type GraphNode = KnowledgeNode & {
  depth?: number;
  x?: number;
  y?: number;
};

export type GraphPayload = {
  nodes: GraphNode[];
  edges: KnowledgeEdge[];
  focusId?: string;
};

export type ProductMetrics = {
  memoryCount: number;
  entityCount: number;
  relationshipCount: number;
  relationshipTypes: number;
  capturesThisWeek: number;
};

export type CapabilityStatus = {
  databaseUrlConfigured: boolean;
  pgGraph: {
    available: boolean;
    mode: "native" | "recursive_sql_fallback";
    nodeCount?: number;
    edgeCount?: number;
    error?: string;
  };
  vector: {
    available: boolean;
    mode: "pgvector_hnsw" | "float8_cosine_fallback";
    indexed: boolean;
  };
};

export type CaptureInput = {
  text: string;
  title?: string;
  tags?: string[];
  sourceUrl?: string;
  importance?: number;
};

export type AskResponse = {
  answer: string;
  evidence: SearchHit[];
  graph: GraphPayload;
};
