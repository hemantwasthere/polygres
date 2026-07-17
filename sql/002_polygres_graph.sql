DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS graph;
EXCEPTION
  WHEN undefined_file THEN
    RAISE NOTICE 'pgGraph extension is not installed; graph queries will use recursive SQL fallback.';
  WHEN feature_not_supported THEN
    RAISE NOTICE 'pgGraph extension is not available; graph queries will use recursive SQL fallback.';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'graph') THEN
    PERFORM graph.reset();

    PERFORM graph.add_table(
      'public.knowledge_nodes'::regclass,
      id_column := 'id',
      columns := ARRAY['title', 'summary', 'content', 'node_type', 'sentiment']
    );

    PERFORM graph.add_edge(
      from_table := 'public.knowledge_edges'::regclass,
      from_column := 'from_node_id',
      to_table := 'public.knowledge_nodes'::regclass,
      to_column := 'to_node_id',
      label := 'related_to',
      bidirectional := true,
      label_column := 'label',
      weight_column := 'strength'
    );

    PERFORM graph.add_filter_column(
      table_name := 'public.knowledge_nodes'::regclass,
      column_name := 'node_type',
      column_type := 'text'
    );

    PERFORM graph.build();

    INSERT INTO app_events(event_name, detail)
    VALUES ('pggraph_registered', jsonb_build_object('mode', 'native', 'at', now()));
  ELSE
    INSERT INTO app_events(event_name, detail)
    VALUES ('pggraph_unavailable', jsonb_build_object('mode', 'recursive_sql_fallback', 'at', now()));
  END IF;
END $$;
