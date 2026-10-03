import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "../lib/db";
import { DEMO_USER } from "../lib/demo";
import {
  buildTransactionText,
  embedText,
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  isGeminiConfigured,
} from "../lib/llm";
import { ragTopK, retrieveRelevantTransactions } from "../lib/rag";

const QUERIES = [
  "dining spend last month",
  "all EMI payments",
  "biggest travel expense",
];
const RUNS = 5;

function avg(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function loadDemoUserId() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  try {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [DEMO_USER.email],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const k = ragTopK();
  const mock = !isGeminiConfigured();
  const userId = await loadDemoUserId();

  const embedSamples: number[] = [];
  const searchSamples: number[] = [];
  const queryBlocks: string[] = [];

  for (const queryText of QUERIES) {
    const embedTimes: number[] = [];
    const searchTimes: number[] = [];
    let lastResults: Awaited<ReturnType<typeof retrieveRelevantTransactions>> = [];

    for (let run = 0; run < RUNS; run += 1) {
      const embedStarted = performance.now();
      await embedText(queryText);
      embedTimes.push(performance.now() - embedStarted);

      if (userId) {
        const searchStarted = performance.now();
        lastResults = await retrieveRelevantTransactions(userId, queryText, k);
        searchTimes.push(performance.now() - searchStarted);
      }
    }

    embedSamples.push(...embedTimes);
    searchSamples.push(...searchTimes);

    const top = lastResults
      .slice(0, k)
      .map(
        (row, index) =>
          `${index + 1}. ${row.occurredOn} | ${row.merchantName ?? "?"} | ${row.category ?? "?"} | ${row.amount} (sim ${row.similarity.toFixed(3)})`,
      )
      .join("\n");

    queryBlocks.push(`### "${queryText}"

- Average embed latency: ${avg(embedTimes).toFixed(2)} ms
- Average vector-search latency: ${
      searchTimes.length ? `${avg(searchTimes).toFixed(2)} ms` : "n/a (no DATABASE_URL / demo user)"
    }

${top || "_No rows returned. Run `npm run seed` first._"}
`);
  }

  const markdown = `# RAG pipeline

Spendsense retrieval is **one transaction = one chunk = one pgvector row**. There is no multi-sentence document splitting. That matches the data: each spend event is already a discrete fact with a date, merchant, category, amount, and raw description.

## Chunk text

Indexing and (model-side) querying share \`buildTransactionText\`:

\`\`\`
\${date} | \${merchant_name} | \${category} | amount \${amount} | \${raw_description}
\`\`\`

Example: \`${buildTransactionText({
    occurredOn: "2026-09-15",
    merchantName: "Chipotle",
    category: "food",
    amount: 14.2,
    rawDescription: "CHIPOTLE",
  })}\`

Row-level chunks keep retrieval user-isolatable (\`WHERE user_id = $1\`) and make later copilot citations map 1:1 to a ledger line. Aggregating several transactions into one embedding would blur amounts and dates.

Natural-language questions are embedded with the same \`embedText\` function (same model, 768-d, L2-normalized). In MOCK mode, query tokens get light aliases (\`dining\` → \`food\`, \`emi\` → \`sofi loan\`) so hashed token vectors still overlap category/merchant tokens.

## Embedding model

- Production: Gemini \`${EMBEDDING_MODEL}\` (${EMBEDDING_DIMS} dimensions, free-tier friendly).
- Fallback: deterministic hashed token vectors, also ${EMBEDDING_DIMS}-d and L2-normalized, so the \`vector(768)\` column and HNSW index never change shape.
- Switch: set \`GEMINI_API_KEY\`. Empty key keeps MOCK embeddings.

Embeddings are **precomputed in \`npm run seed\`** via \`embedTransactionsForUser\`. The HTTP handler only embeds the query.

## Retrieval-k and operator

- \`RAG_TOP_K\` (default ${k}) is enough for a later copilot prompt without stuffing the context window.
- Distance: pgvector cosine operator \`<=>\` (\`vector_cosine_ops\`).
- Score returned to clients: \`1 - (embedding <=> query)\` so higher is closer.
- Index: HNSW on \`transactions.embedding\` (see \`db/migrations/001_init.sql\` and \`003_vector_index.sql\`). HNSW is preferred over IVFFlat here because seed volume is hundreds of rows and IVFFlat wants a trained \`lists\` count.

LangChain.js is used as a thin \`BaseRetriever\` (\`UserScopedTransactionRetriever\`). The SQL is authored by us and **always** includes \`user_id\`.

## Measured latency

- GEMINI_API_KEY present: ${mock ? "no (MOCK embeddings)" : "yes"}
- Demo user seeded: ${userId ? "yes" : "no"}
- Runs per query: ${RUNS}
- Average embed latency: ${avg(embedSamples).toFixed(2)} ms
- Average vector-search latency (includes query embed + SQL): ${
    searchSamples.length ? `${avg(searchSamples).toFixed(2)} ms` : "n/a"
  }

${queryBlocks.join("\n")}
`;

  const docsDir = path.join(process.cwd(), "docs");
  await mkdir(docsDir, { recursive: true });
  const outPath = path.join(docsDir, "rag-pipeline.md");
  await writeFile(outPath, markdown, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`Embed avg: ${avg(embedSamples).toFixed(2)} ms`);
  if (searchSamples.length) {
    console.log(`Search avg: ${avg(searchSamples).toFixed(2)} ms`);
  } else {
    console.log("Search skipped — seed the demo user to measure vector search.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
