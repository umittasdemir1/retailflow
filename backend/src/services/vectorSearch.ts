export interface VectorItem {
  featureVector: number[];
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const size = Math.min(a.length, b.length);
  for (let i = 0; i < size; i++) dot += a[i] * b[i];
  return dot;
}

export function searchNearest<T extends VectorItem>(
  query: number[],
  items: T[],
  limit = 3,
): SearchHit<T>[] {
  return items
    .map((item) => ({
      item,
      score: cosineSimilarity(query, item.featureVector),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, limit));
}
