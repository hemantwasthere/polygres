export const EMBEDDING_DIMENSIONS = 384;

const IMPORTANT_TERMS = new Set([
  "polygres",
  "pggraph",
  "postgres",
  "postgresql",
  "vector",
  "hnsw",
  "agent",
  "memory",
  "graph",
  "retrieval",
  "project",
  "person",
  "topic"
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .match(/[a-z0-9+#.-]{2,}/g) ?? [];
}

function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function addFeature(vector: number[], feature: string, weight: number) {
  const hash = hash32(feature);
  const index = hash % EMBEDDING_DIMENSIONS;
  const sign = hash & 1 ? 1 : -1;
  vector[index] += sign * weight;
}

export function embedText(text: string): number[] {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const tokens = tokenize(text);

  tokens.forEach((token, index) => {
    const baseWeight = IMPORTANT_TERMS.has(token) ? 1.8 : 1;
    addFeature(vector, `tok:${token}`, baseWeight);

    if (token.length > 4) {
      for (let offset = 0; offset <= token.length - 3; offset += 1) {
        addFeature(vector, `tri:${token.slice(offset, offset + 3)}`, 0.18);
      }
    }

    const previous = tokens[index - 1];
    if (previous) {
      addFeature(vector, `bi:${previous}_${token}`, 0.65);
    }
  });

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / norm).toFixed(8)));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value.toFixed(8))).join(",")}]`;
}

export function summarize(text: string, maxLength = 220): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  const slice = compact.slice(0, maxLength);
  const lastBreak = Math.max(slice.lastIndexOf("."), slice.lastIndexOf(";"), slice.lastIndexOf(","));
  return `${slice.slice(0, lastBreak > 80 ? lastBreak + 1 : maxLength).trim()}...`;
}
