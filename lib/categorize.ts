import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import {
  CATEGORIES,
  type CategorizeInput,
  type CategorizeResult,
  isCategory,
  normalizeMerchant,
  ruleBasedCategorize,
} from "./categories";
import { query } from "./db";

export type { CategorizeInput, CategorizeResult };

const responseSchema = z.object({
  category: z.string(),
  confidence: z.number(),
});

const GEMINI_MODEL = "gemini-1.5-flash";
const CHUNK_SIZE = 8;
const CHUNK_DELAY_MS = 400;
const API_BATCH_LIMIT = 25;
const API_BUDGET_MS = 8_000;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const merchantCache = new Map<string, CategorizeResult>();

export function mockCategorize(input: CategorizeInput): CategorizeResult {
  return ruleBasedCategorize(input);
}

function fewShotPrompt(input: CategorizeInput) {
  return `You are Spendsense's transaction classifier.
Return ONLY JSON: {"category":"<enum>","confidence":<0-1 float>}.
Allowed category values: ${CATEGORIES.join(", ")}.
Confidence is how sure you are, from 0 to 1.

Examples:
{"merchant_name":"Starbucks","amount":6.45,"raw_description":"STARBUCKS"} -> {"category":"food","confidence":0.93}
{"merchant_name":"Whole Foods Market","amount":54.10,"raw_description":"WHOLE FOODS MARKET"} -> {"category":"groceries","confidence":0.95}
{"merchant_name":"Delta Air Lines","amount":312.00,"raw_description":"DELTA AIR LINES"} -> {"category":"travel","confidence":0.92}
{"merchant_name":"PG&E","amount":98.40,"raw_description":"PG&E"} -> {"category":"utilities","confidence":0.94}
{"merchant_name":"SoFi Personal Loan","amount":425.00,"raw_description":"SOFI PERSONAL LOAN"} -> {"category":"EMI","confidence":0.96}
{"merchant_name":"Netflix","amount":15.49,"raw_description":"NETFLIX"} -> {"category":"entertainment","confidence":0.97}
{"merchant_name":"Acme Payroll","amount":-1980.00,"raw_description":"ACME PAYROLL DIRECT DEP"} -> {"category":"income","confidence":0.99}
{"merchant_name":"CVS Pharmacy","amount":18.22,"raw_description":"CVS PHARMACY"} -> {"category":"health","confidence":0.9}
{"merchant_name":"Amazon","amount":42.17,"raw_description":"AMAZON"} -> {"category":"shopping","confidence":0.88}
{"merchant_name":"Urban Living Apts","amount":2100.00,"raw_description":"URBAN LIVING APTS"} -> {"category":"other","confidence":0.6}

Classify this transaction:
${JSON.stringify({
    merchant_name: input.merchantName ?? input.name ?? "",
    amount: input.amount,
    raw_description: input.rawDescription ?? "",
  })}`;
}

function parseModelText(text: string): CategorizeResult | null {
  const stripped = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = responseSchema.parse(JSON.parse(stripped));
    if (!isCategory(parsed.category)) {
      return null;
    }
    const confidence = Math.min(1, Math.max(0, parsed.confidence));
    return { category: parsed.category, confidence };
  } catch {
    return null;
  }
}

async function geminiCategorize(input: CategorizeInput): Promise<CategorizeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return mockCategorize(input);
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  const prompt = fewShotPrompt(input);
  const run = async () => {
    const result = await model.generateContent(prompt);
    return parseModelText(result.response.text());
  };

  try {
    const first = await run();
    if (first) {
      return first;
    }
  } catch {
    // retry once below
  }

  try {
    const second = await run();
    if (second) {
      return second;
    }
  } catch {
    // fall through
  }

  return { category: "other", confidence: 0 };
}

export async function categorizeTransaction(input: CategorizeInput): Promise<CategorizeResult> {
  const cacheKey = normalizeMerchant(input.merchantName ?? input.name);
  if (cacheKey && merchantCache.has(cacheKey)) {
    return merchantCache.get(cacheKey)!;
  }

  const result = isGeminiConfigured() ? await geminiCategorize(input) : mockCategorize(input);

  if (cacheKey) {
    merchantCache.set(cacheKey, result);
  }
  return result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type UncategorizedRow = {
  id: string;
  merchant_name: string | null;
  name: string | null;
  raw_description: string | null;
  amount: string;
};

export async function categorizeUncategorizedForUser(
  userId: string,
  options?: { limit?: number; budgetMs?: number },
) {
  const limit = options?.limit ?? Number.POSITIVE_INFINITY;
  const budgetMs = options?.budgetMs;
  const started = Date.now();

  const { rows } = await query<UncategorizedRow>(
    `SELECT id, merchant_name, name, raw_description, amount::text AS amount
     FROM transactions
     WHERE user_id = $1
       AND category IS NULL
     ORDER BY occurred_on DESC, created_at DESC
     LIMIT $2`,
    [userId, Number.isFinite(limit) ? limit : 10_000],
  );

  let categorized = 0;
  let lowConfidence = 0;
  let delay = CHUNK_DELAY_MS;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    if (budgetMs && Date.now() - started > budgetMs) {
      break;
    }

    const chunk = rows.slice(i, i + CHUNK_SIZE);
    for (const row of chunk) {
      const result = await categorizeTransaction({
        merchantName: row.merchant_name,
        name: row.name,
        rawDescription: row.raw_description,
        amount: Number(row.amount),
      });

      await query(
        `UPDATE transactions
         SET category = $1, confidence = $2
         WHERE id = $3 AND user_id = $4 AND category IS NULL`,
        [result.category, result.confidence, row.id, userId],
      );

      categorized += 1;
      if (result.confidence < 0.6) {
        lowConfidence += 1;
      }
    }

    if (i + CHUNK_SIZE < rows.length) {
      await sleep(delay);
      delay = Math.min(delay * 1.5, 4_000);
    }
  }

  return {
    scanned: rows.length,
    categorized,
    lowConfidence,
    mock: !isGeminiConfigured(),
  };
}

export async function categorizeApiBatch(userId: string) {
  return categorizeUncategorizedForUser(userId, {
    limit: API_BATCH_LIMIT,
    budgetMs: API_BUDGET_MS,
  });
}

export const categorizer = {
  categorize: categorizeTransaction,
};
