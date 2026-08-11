import { embed, embedMany } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { RetrievalMode } from "@/lib/types";

// -----------------------------------------------------------------------
// RAG retrieval (server-side).
//
// Two retrievers implement the same `Retriever` interface:
//   - EmbeddingRetriever: dense vector search via Mistral's `mistral-embed`
//     (semantic similarity). This is the default.
//   - TfIdfRetriever: dependency-free TF-IDF + cosine similarity, kept as a
//     fallback (no embeddings API key, rate limit, or offline).
//
// The pipeline is still genuinely RAG: parse -> chunk -> retrieve -> augment
// -> generate grounded in context -> grade against retrieved context
// (evaluator.ts). buildRetriever tries vectors first and automatically falls
// back to TF-IDF, reporting which mode it used so the UI can show it.
// -----------------------------------------------------------------------

export interface RetrievedChunk {
  text: string;
  score: number;
}

export interface Retriever {
  index(chunks: string[]): Promise<void>;
  retrieve(query: string, topK?: number): Promise<RetrievedChunk[]>;
}


const STOPWORDS = new Set([
  "a", "about", "after", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "being", "between", "both", "but",
  "by", "can", "could", "did", "do", "does", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here",
  "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "just",
  "me", "more", "most", "my", "no", "nor", "not", "now", "of", "off", "on",
  "once", "only", "or", "other", "our", "out", "over", "own", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "we", "were", "what", "when",
  "where", "which", "while", "who", "whom", "why", "will", "with", "would",
  "you", "your",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function chunkText(
  text: string,
  maxWords = 200,
  overlapWords = 40
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const step = Math.max(1, maxWords - overlapWords);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + maxWords).join(" ");
    if (slice.trim()) chunks.push(slice);
  }
  return chunks.length ? chunks : [text];
}

// -----------------------------------------------------------------------
// TF-IDF + cosine similarity
// -----------------------------------------------------------------------
export class TfIdfRetriever implements Retriever {
  private chunks: string[] = [];
  private termIndex = new Map<string, Map<number, number>>(); // term -> chunkIdx -> tf
  private docCount = 0;
  private idfCache = new Map<string, number>();

  async index(chunks: string[]): Promise<void> {
    this.chunks = chunks;
    this.docCount = chunks.length;
    this.termIndex.clear();
    this.idfCache.clear();
    chunks.forEach((chunk, idx) => {
      const tf = new Map<string, number>();
      for (const t of tokenize(chunk)) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [t, count] of tf) {
        if (!this.termIndex.has(t)) this.termIndex.set(t, new Map());
        this.termIndex.get(t)!.set(idx, count);
      }
    });
  }

  private idf(term: string): number {
    if (this.idfCache.has(term)) return this.idfCache.get(term)!;
    const df = this.termIndex.get(term)?.size ?? 0;
    const value = df === 0 ? 0 : Math.log((this.docCount + 1) / (df + 1)) + 1;
    this.idfCache.set(term, value);
    return value;
  }

  private vectorOf(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const v = new Map<string, number>();
    for (const [t, c] of tf) {
      const weight = (1 + Math.log(c)) * this.idf(t);
      if (weight > 0) v.set(t, weight);
    }
    return v;
  }

  private cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const w of a.values()) normA += w * w;
    for (const w of b.values()) normB += w * w;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    for (const [t, w] of small) {
      const other = big.get(t);
      if (other !== undefined) dot += w * other;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async retrieve(query: string, topK = 3): Promise<RetrievedChunk[]> {
    const qv = this.vectorOf(tokenize(query));
    const scored = this.chunks.map((chunk, idx) => ({
      idx,
      score: this.cosine(qv, this.vectorOf(tokenize(chunk))),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored
      .slice(0, topK)
      .map((s) => ({ text: this.chunks[s.idx], score: s.score }));
  }
}

export function cosineVectors(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Cap on how many chunks we embed. A 25 MB file can produce thousands of
// chunks; embedding them all is slow and risks free-tier rate limits. We
// embed the first N and warn when later chunks are dropped.
const MAX_EMBEDDED_CHUNKS = 300;

// -----------------------------------------------------------------------
// Dense vector retrieval using Mistral's `mistral-embed` embedding model.
// Same Retriever interface as TfIdfRetriever, so nothing above the factory
// (buildRetriever) needs to know which backend is in use.
// -----------------------------------------------------------------------
export class EmbeddingRetriever implements Retriever {
  private chunks: string[] = [];
  private embeddings: number[][] = [];
  private model = mistral.embedding("mistral-embed");

  async index(chunks: string[]): Promise<void> {
    const toEmbed = chunks.slice(0, MAX_EMBEDDED_CHUNKS);
    const { embeddings } = await embedMany({
      model: this.model,
      values: toEmbed,
    });
    this.embeddings = embeddings;
    this.chunks = toEmbed;
    if (chunks.length > toEmbed.length) {
      console.warn(
        `[rag] Embedded ${toEmbed.length} of ${chunks.length} chunks ` +
          `(cap ${MAX_EMBEDDED_CHUNKS}); later chunks aren't retrievable.`
      );
    }
  }

  async retrieve(query: string, topK = 3): Promise<RetrievedChunk[]> {
    const { embedding } = await embed({ model: this.model, value: query });
    const scored = this.embeddings.map((vec, idx) => ({
      idx,
      score: cosineVectors(embedding, vec),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored
      .slice(0, topK)
      .map((s) => ({ text: this.chunks[s.idx], score: s.score }));
  }
}

export function buildRagPrompt(
  question: string,
  chunks: RetrievedChunk[]
): string {
  const context = chunks
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
  return [
    "Answer the question below using ONLY the provided context.",
    "If the context does not contain the answer, say you don't know instead of guessing.",
    "Do not invent or assert facts that are not supported by the context.",
    "Where useful, reference the specific passage you based your answer on.",
    "",
    "Context:",
    '"""',
    context,
    '"""',
    "",
    `Question: ${question}`,
  ].join("\n");
}

// Factory used by /api/tests when a RAG context file is supplied.
// Tries dense vector retrieval first (semantic, better recall) and
// automatically falls back to TF-IDF if the embeddings provider fails
// (no MISTRAL_API_KEY, rate limit, network error). The chosen mode is
// returned so the API can store/show it.
export async function buildRetriever(text: string): Promise<{
  retriever: Retriever;
  chunks: string[];
  mode: RetrievalMode;
}> {
  const chunks = chunkText(text);
  try {
    const retriever = new EmbeddingRetriever();
    await retriever.index(chunks);
    return { retriever, chunks, mode: "vector" };
  } catch (err) {
    console.warn(
      `[rag] Vector retrieval unavailable (${
        err instanceof Error ? err.message : String(err)
      }); falling back to TF-IDF.`
    );
    const retriever = new TfIdfRetriever();
    await retriever.index(chunks);
    return { retriever, chunks, mode: "tfidf" };
  }
}