CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN undefined_file THEN
    RAISE NOTICE 'pgvector is not installed; semantic search will use double precision[] fallback.';
  WHEN feature_not_supported THEN
    RAISE NOTICE 'pgvector is not available; semantic search will use double precision[] fallback.';
END $$;

CREATE TABLE IF NOT EXISTS app_events (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id text PRIMARY KEY DEFAULT ('node_' || replace(gen_random_uuid()::text, '-', '')),
  node_type text NOT NULL CHECK (node_type IN ('memory', 'person', 'project', 'topic', 'source', 'claim', 'question')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  source_url text,
  importance integer NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  sentiment text NOT NULL DEFAULT 'neutral',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding double precision[] NOT NULL DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id text PRIMARY KEY DEFAULT ('edge_' || replace(gen_random_uuid()::text, '-', '')),
  from_node_id text NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  to_node_id text NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'related_to',
  strength numeric(5, 3) NOT NULL DEFAULT 0.700 CHECK (strength >= 0 AND strength <= 1),
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_node_id, to_node_id, label)
);

CREATE TABLE IF NOT EXISTS capture_inbox (
  id text PRIMARY KEY DEFAULT ('capture_' || replace(gen_random_uuid()::text, '-', '')),
  raw_text text NOT NULL,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'needs_review', 'archived')),
  created_node_id text REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_type ON knowledge_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_created_at ON knowledge_nodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_tags ON knowledge_nodes USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_search ON knowledge_nodes USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_title_trgm ON knowledge_nodes USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_from ON knowledge_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_to ON knowledge_edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_label ON knowledge_edges(label);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_knowledge_nodes_updated_at ON knowledge_nodes;
CREATE TRIGGER touch_knowledge_nodes_updated_at
BEFORE UPDATE ON knowledge_nodes
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION cosine_similarity(a double precision[], b double precision[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN cardinality(a) = 0 OR cardinality(b) = 0 OR sums.norm_a = 0 OR sums.norm_b = 0 THEN 0
    ELSE sums.dot / (sqrt(sums.norm_a) * sqrt(sums.norm_b))
  END
  FROM (
    SELECT
      coalesce(sum(x * y), 0) AS dot,
      coalesce(sum(x * x), 0) AS norm_a,
      coalesce(sum(y * y), 0) AS norm_b
    FROM unnest(a, b) AS pairs(x, y)
  ) AS sums;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS embedding_vector vector(384);
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_embedding_hnsw ON knowledge_nodes USING hnsw (embedding_vector vector_cosine_ops)';
  END IF;
END $$;

CREATE OR REPLACE VIEW knowledge_product_metrics AS
SELECT
  (SELECT count(*) FROM knowledge_nodes WHERE node_type = 'memory') AS memory_count,
  (SELECT count(*) FROM knowledge_nodes WHERE node_type <> 'memory') AS entity_count,
  (SELECT count(*) FROM knowledge_edges) AS relationship_count,
  (SELECT count(DISTINCT label) FROM knowledge_edges) AS relationship_types,
  (SELECT count(*) FROM capture_inbox WHERE created_at > now() - interval '7 days') AS captures_this_week;
