/**
 * Semantic Memory Search — retrieves relevant past conversation entries using
 * TF-IDF vectorization and cosine similarity.
 *
 * Unlike linear list/restore which returns the full window, semantic search
 * finds the most topically relevant memories across the entire history —
 * even entries that were compressed out of the active window.
 *
 * This enables the Agent to recall decisions, preferences, and patterns from
 * earlier in the session or from restored persistent memory, improving
 * contextual awareness without inflating the prompt window.
 *
 * The implementation is dependency-free: TF-IDF is computed on the fly from
 * tokenized text, and cosine similarity is a dot product of sparse vectors.
 */

import type { MemoryEntry } from "./store.js";

/** Tokenize text into lowercase word unigrams, stripping punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Compute term frequency map for a document. */
function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length || 1;
  for (const [k, v] of tf) {
    tf.set(k, v / len);
  }
  return tf;
}

/** Compute inverse document frequency across a corpus. */
function computeIdf(documents: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const N = documents.length;
  for (const doc of documents) {
    const seen = new Set(doc);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    // Smoothed IDF: log((N + 1) / (count + 1)) + 1
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
  }
  return idf;
}

/** Compute TF-IDF vector for a document given IDF weights. */
function tfidf(tokens: string[], tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
  const vec = new Map<string, number>();
  for (const term of new Set(tokens)) {
    const tfVal = tf.get(term) ?? 0;
    const idfVal = idf.get(term) ?? 0;
    vec.set(term, tfVal * idfVal);
  }
  return vec;
}

/** Cosine similarity between two sparse vectors. */
function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  // Iterate over the smaller vector for efficiency
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, va] of small) {
    const vb = large.get(k);
    if (vb !== undefined) dot += va * vb;
    magA += va * va;
  }
  for (const [, vb] of b) magB += vb * vb;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  /** Why this entry matched — the top contributing terms. */
  matchedTerms: string[];
}

/**
 * Search memory entries for the most relevant past context.
 *
 * @param entries  The full memory history to search across
 * @param query    The current user message or intent
 * @param limit    Max results to return (default 5)
 * @param threshold Minimum similarity score to include (default 0.05)
 */
export function semanticSearch(
  entries: MemoryEntry[],
  query: string,
  limit = 5,
  threshold = 0.05,
): SearchResult[] {
  if (entries.length === 0) return [];

  // Build the corpus: each memory entry's content is a document
  const docs = entries.map((e) => {
    const parts: string[] = [];
    if (e.content) parts.push(e.content);
    if (e.toolName) parts.push(`tool:${e.toolName}`);
    if (e.toolCalls) parts.push(...e.toolCalls.map((c) => `tool:${c.tool}`));
    return tokenize(parts.join(" "));
  });

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const idf = computeIdf(docs);
  const queryTf = termFreq(queryTokens);
  const queryVec = tfidf(queryTokens, queryTf, idf);

  const results: SearchResult[] = [];
  for (let i = 0; i < entries.length; i++) {
    const docVec = tfidf(docs[i], termFreq(docs[i]), idf);
    const score = cosineSim(queryVec, docVec);
    if (score >= threshold) {
      // Find the top contributing terms for explainability
      const matchedTerms: string[] = [];
      const contributions: Array<[string, number]> = [];
      for (const term of queryTokens) {
        const q = queryVec.get(term) ?? 0;
        const d = docVec.get(term) ?? 0;
        if (q > 0 && d > 0) {
          contributions.push([term, q * d]);
        }
      }
      contributions.sort((a, b) => b[1] - a[1]);
      matchedTerms.push(...contributions.slice(0, 5).map((c) => c[0]));
      results.push({ entry: entries[i], score, matchedTerms });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Format search results as a compact context string for injection into the
 * system prompt. This gives the Agent access to relevant past decisions
 * without bloating the conversation window.
 */
export function formatRelevantMemory(results: SearchResult[]): string {
  if (results.length === 0) return "";
  const lines: string[] = [];
  lines.push("[Relevant past context]");
  for (const r of results) {
    const role = r.entry.role;
    const content = r.entry.content.slice(0, 200);
    const terms = r.matchedTerms.length > 0 ? ` (matched: ${r.matchedTerms.join(", ")})` : "";
    lines.push(`[${role}]${terms} ${content}`);
  }
  return lines.join("\n");
}
