INSERT INTO knowledge_nodes (id, node_type, title, content, summary, tags, importance, sentiment, metadata)
VALUES
  ('mem_polygres', 'memory', 'Polygres turns Postgres into an AI-native memory substrate', 'Polygres keeps regular PostgreSQL as the system of record while adding native graph traversal and semantic retrieval. That means notes, entities, relationships, and embeddings can live together without ETL or a separate graph/vector database.', 'Postgres remains authoritative while graph and vector retrieval make the data easier for agents to navigate.', ARRAY['polygres','postgres','ai-native'], 5, 'curious', '{"source":"seed"}'),
  ('mem_demo_day', 'memory', 'Fundraising demo narrative', 'The product should show investors a capture-to-recall loop: add messy personal context, extract structured entities, traverse the knowledge graph, and answer questions with evidence. The local demo should work without external keys.', 'Show the full loop from capture to evidence-backed recall.', ARRAY['fundraising','demo','product'], 5, 'focused', '{"source":"seed"}'),
  ('mem_agent_memory', 'memory', 'Agent memory needs relationships, not just chunks', 'A useful knowledge graph should remember who, what, why, and how ideas connect. Vector search finds similar memories; graph traversal finds related people, projects, topics, and dependencies.', 'Hybrid memory combines semantic similarity with explicit relationships.', ARRAY['agent-memory','retrieval','knowledge-graph'], 5, 'confident', '{"source":"seed"}'),
  ('topic_polygres', 'topic', 'Polygres', 'PostgreSQL hosting with graph traversal, vector search, and hybrid retrieval APIs.', 'AI-native Postgres layer.', ARRAY['database','infra'], 5, 'neutral', '{"source":"seed"}'),
  ('topic_pggraph', 'topic', 'pgGraph', 'A Postgres extension from Evokoa that accelerates bounded traversal over relational data using derived graph indexes.', 'Native graph traversal for Postgres.', ARRAY['graph','postgres'], 5, 'neutral', '{"source":"seed"}'),
  ('topic_vectors', 'topic', 'HNSW vector search', 'Approximate nearest-neighbor search for embeddings. In this app, pgvector HNSW is used when available and a deterministic fallback keeps local search working everywhere.', 'Semantic recall layer.', ARRAY['vector','semantic-search'], 4, 'neutral', '{"source":"seed"}'),
  ('project_synapse', 'project', 'Synapse Product', 'A polished personal knowledge graph for capturing notes, building relationships, and asking evidence-backed questions.', 'Investor-ready knowledge graph product.', ARRAY['product','synapse'], 5, 'optimistic', '{"source":"seed"}'),
  ('person_user', 'person', 'You', 'The owner of this knowledge graph. Your captures, goals, people, and projects become graph nodes that can be searched and traversed.', 'The graph owner.', ARRAY['identity'], 4, 'neutral', '{"source":"seed"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_edges (from_node_id, to_node_id, label, strength, reason, metadata)
VALUES
  ('mem_polygres', 'topic_polygres', 'explains', 0.950, 'The note describes Polygres directly.', '{"source":"seed"}'),
  ('mem_polygres', 'topic_pggraph', 'mentions', 0.900, 'pgGraph is the graph component of the stack.', '{"source":"seed"}'),
  ('mem_polygres', 'topic_vectors', 'mentions', 0.820, 'The note references semantic retrieval and vector search.', '{"source":"seed"}'),
  ('mem_demo_day', 'project_synapse', 'belongs_to', 0.960, 'The fundraising narrative is about this product.', '{"source":"seed"}'),
  ('mem_demo_day', 'topic_polygres', 'uses', 0.870, 'The demo story depends on Polygres positioning.', '{"source":"seed"}'),
  ('mem_agent_memory', 'topic_vectors', 'uses', 0.910, 'Semantic similarity is a core retrieval mode.', '{"source":"seed"}'),
  ('mem_agent_memory', 'topic_pggraph', 'uses', 0.910, 'Graph traversal is a core retrieval mode.', '{"source":"seed"}'),
  ('project_synapse', 'topic_polygres', 'built_on', 0.930, 'The product is designed around Polygres-native capabilities.', '{"source":"seed"}'),
  ('person_user', 'project_synapse', 'owns', 0.900, 'The user owns the workspace and graph.', '{"source":"seed"}')
ON CONFLICT (from_node_id, to_node_id, label) DO UPDATE
SET strength = EXCLUDED.strength,
    reason = EXCLUDED.reason;
