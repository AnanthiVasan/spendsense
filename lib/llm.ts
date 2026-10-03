import { GoogleGenerativeAI } from "@google/generative-ai";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type EmbeddingVector = number[];

export const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIMS = 768;

const EMBED_BATCH_SIZE = 16;
const MAX_RETRIES = 4;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export type TransactionTextInput = {
  occurredOn?: string | null;
  merchantName?: string | null;
  category?: string | null;
  amount: number | string;
  rawDescription?: string | null;
};

export function buildTransactionText(input: TransactionTextInput) {
  const date = input.occurredOn ?? "";
  const merchant = input.merchantName ?? "";
  const category = input.category ?? "";
  const amount = typeof input.amount === "number" ? input.amount.toFixed(2) : input.amount;
  const raw = input.rawDescription ?? "";
  return `${date} | ${merchant} | ${category} | amount ${amount} | ${raw}`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashToken(token: string) {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function l2Normalize(values: number[]) {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => value / norm);
}

const QUERY_ALIASES: Record<string, string> = {
  dining: "food restaurant chipotle starbucks",
  dinner: "food chipotle",
  lunch: "food chipotle",
  eat: "food chipotle",
  food: "food chipotle starbucks restaurant",
  shopping: "shopping amazon",
  travel: "travel uber delta airlines",
  groceries: "groceries whole foods trader",
  entertainment: "entertainment netflix spotify",
  emi: "emi sofi loan installment",
  loan: "emi sofi loan",
  rent: "rent urban living",
};

const QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "about",
  "did",
  "do",
  "does",
  "for",
  "how",
  "i",
  "in",
  "is",
  "last",
  "list",
  "me",
  "month",
  "much",
  "my",
  "of",
  "on",
  "spend",
  "spending",
  "spent",
  "the",
  "this",
  "to",
  "was",
  "what",
  "why",
]);

export function expandQueryForEmbedding(query: string) {
  const tokens = query.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean);
  const meaningful = tokens.filter((token) => !QUERY_STOPWORDS.has(token));
  const chosen = meaningful.length > 0 ? meaningful : tokens;
  return chosen.map((token) => QUERY_ALIASES[token] ?? token).join(" ");
}

export function mockEmbedText(text: string): EmbeddingVector {
  const vector = Array.from({ length: EMBEDDING_DIMS }, () => 0);
  const tokens = text.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean);
  const source = tokens.length > 0 ? tokens : ["empty"];

  for (const token of source) {
    const rng = mulberry32(hashToken(token));
    for (let i = 0; i < EMBEDDING_DIMS; i += 1) {
      vector[i] += rng() * 2 - 1;
    }
  }

  return l2Normalize(vector);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geminiEmbedBatch(texts: string[]): Promise<EmbeddingVector[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return texts.map(mockEmbedText);
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  let attempt = 0;
  while (true) {
    try {
      const response = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { role: "user", parts: [{ text }] },
        })),
      });
      return response.embeddings.map((embedding) => {
        const values = embedding.values ?? [];
        if (values.length !== EMBEDDING_DIMS) {
          throw new Error(`Unexpected embedding size ${values.length}`);
        }
        return l2Normalize(values);
      });
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      await sleep(200 * 2 ** (attempt - 1));
    }
  }
}

export async function embedText(text: string): Promise<EmbeddingVector> {
  const [vector] = await embedBatch([text]);
  return vector;
}

export async function embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
  if (texts.length === 0) {
    return [];
  }

  if (!isGeminiConfigured()) {
    return texts.map(mockEmbedText);
  }

  const output: EmbeddingVector[] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const chunk = texts.slice(i, i + EMBED_BATCH_SIZE);
    output.push(...(await geminiEmbedBatch(chunk)));
    if (i + EMBED_BATCH_SIZE < texts.length) {
      await sleep(250);
    }
  }
  return output;
}

export function formatVectorLiteral(vector: EmbeddingVector) {
  return `[${vector.map((value) => value.toFixed(8)).join(",")}]`;
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function chat(_messages: ChatMessage[]): Promise<string> {
  throw new Error("Gemini chat is implemented in Step 5 (copilot).");
}
