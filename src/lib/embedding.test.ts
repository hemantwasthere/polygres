import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS, cosineSimilarity, embedText } from "./embedding";

describe("local embeddings", () => {
  it("creates stable normalized vectors", () => {
    const first = embedText("Polygres graph memory retrieval");
    const second = embedText("Polygres graph memory retrieval");

    expect(first).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(second).toEqual(first);
    expect(cosineSimilarity(first, second)).toBeGreaterThan(0.99);
  });

  it("scores related database memories higher than unrelated text", () => {
    const query = embedText("graph traversal and vector search in postgres");
    const related = embedText("Polygres uses pgGraph and vector search inside PostgreSQL");
    const unrelated = embedText("weekly meal planning and grocery list");

    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });
});
