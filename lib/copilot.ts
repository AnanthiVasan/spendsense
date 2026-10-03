import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  REFUSAL_MESSAGE,
  type CopilotAnswer,
  type CopilotCitation,
} from "./copilot-contract";
import { isGeminiConfigured } from "./llm";
import { formatInr } from "./money";
import { ragTopK, retrieveRelevantTransactions, type RetrievedTransaction } from "./rag";
import { enforceCopilotQuota } from "./subscription";

export { REFUSAL_MESSAGE, type CopilotAnswer, type CopilotCitation };

const GEMINI_MODEL = "gemini-1.5-flash";

export function minSimilarity() {
  const value = Number(process.env.MIN_SIMILARITY ?? 0.3);
  return Number.isFinite(value) ? value : 0.3;
}

export function toCitations(rows: RetrievedTransaction[]): CopilotCitation[] {
  return rows.map((row) => ({
    id: row.id,
    date: row.occurredOn,
    merchant_name: row.merchantName,
    amount: row.amount,
    category: row.category,
  }));
}

export function usableRetrievedRows(rows: RetrievedTransaction[]) {
  const threshold = minSimilarity();
  return rows.filter((row) => row.similarity >= threshold);
}

type CategoryAgg = {
  category: string;
  sum: number;
  count: number;
};

export function aggregateByCategory(rows: RetrievedTransaction[]): CategoryAgg[] {
  const buckets = new Map<string, CategoryAgg>();
  for (const row of rows) {
    const category = row.category ?? "other";
    const current = buckets.get(category) ?? { category, sum: 0, count: 0 };
    current.sum += Number(row.amount);
    current.count += 1;
    buckets.set(category, current);
  }
  return [...buckets.values()].sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum));
}

function money(amount: number) {
  return formatInr(amount);
}

function citationLine(row: RetrievedTransaction) {
  const amount = Number(row.amount);
  return `[#${row.id}] ${row.occurredOn} | ${row.merchantName ?? "Unknown"} | ${row.category ?? "uncategorized"} | amount ${amount.toFixed(2)}`;
}

export function mockAnswerFromRows(question: string, rows: RetrievedTransaction[]) {
  const aggregates = aggregateByCategory(rows);
  const totalOut = rows.filter((row) => Number(row.amount) > 0).reduce((sum, row) => sum + Number(row.amount), 0);
  const totalIn = rows.filter((row) => Number(row.amount) < 0).reduce((sum, row) => sum + Number(row.amount), 0);

  const categoryLines = aggregates.map((bucket) => {
    const ids = rows
      .filter((row) => (row.category ?? "other") === bucket.category)
      .map((row) => `[#${row.id}]`)
      .join(" ");
    return `${bucket.category} totaled ${money(bucket.sum)} across ${bucket.count} transaction${bucket.count === 1 ? "" : "s"} ${ids}.`;
  });

  const highlight = rows
    .slice()
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))[0];

  const highlightLine = highlight
    ? `The largest absolute amount in this set is ${money(Number(highlight.amount))} at ${highlight.merchantName ?? "Unknown"} on ${highlight.occurredOn} [#${highlight.id}].`
    : "";

  return [
    `Using only the retrieved ledger rows for “${question.trim()}”, category totals are computed in code (not guessed).`,
    `Outflows in this set are ${money(totalOut)}; inflows are ${money(totalIn)}.`,
    ...categoryLines,
    highlightLine,
  ]
    .filter(Boolean)
    .join(" ");
}

function groundedPrompt(question: string, rows: RetrievedTransaction[]) {
  const context = rows.map(citationLine).join("\n");
  const aggregates = aggregateByCategory(rows)
    .map((bucket) => `${bucket.category}: sum=${bucket.sum.toFixed(2)}, count=${bucket.count}`)
    .join("\n");

  return `You are Spendsense Copilot. Answer the user's spending question using ONLY the transactions and numeric totals below.
Do not invent merchants, dates, or amounts. If the context is insufficient, say you cannot answer from these transactions.
Cite every transaction you rely on with its [#id] tag inline. Write a short narrative (not a bullet dump).
Prefer the provided category totals for any sums.

Question:
${question}

Precomputed totals (use these instead of doing arithmetic):
${aggregates}

Transactions:
${context}`;
}

async function geminiAnswer(question: string, rows: RetrievedTransaction[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return mockAnswerFromRows(question, rows);
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.2 },
  });
  const result = await model.generateContent(groundedPrompt(question, rows));
  const text = result.response.text().trim();
  return text || mockAnswerFromRows(question, rows);
}

export async function answerQuestion(userId: string, question: string): Promise<CopilotAnswer> {
  await enforceCopilotQuota(userId);

  const retrieved = await retrieveRelevantTransactions(userId, question, ragTopK());
  const usable = usableRetrievedRows(retrieved);

  if (usable.length === 0) {
    return {
      answer: REFUSAL_MESSAGE,
      citations: [],
      usedFallback: true,
    };
  }

  const answer = isGeminiConfigured()
    ? await geminiAnswer(question, usable)
    : mockAnswerFromRows(question, usable);

  return {
    answer,
    citations: toCitations(usable),
    usedFallback: false,
  };
}
