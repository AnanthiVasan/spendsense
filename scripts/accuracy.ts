import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CATEGORIES,
  type Category,
  ruleBasedCategorize,
  seedCategoryForMerchant,
} from "../lib/categories";
import { categorizeTransaction, isGeminiConfigured } from "../lib/categorize";
import { query } from "../lib/db";
import { DEMO_USER } from "../lib/demo";
import { generateMockTransactions } from "../lib/plaid-mock";

type EvalRow = {
  merchantName: string;
  amount: number;
  truth: Category;
  predicted: Category;
  baseline: Category;
};

function emptyMatrix() {
  const matrix: Record<Category, Record<Category, number>> = {} as Record<
    Category,
    Record<Category, number>
  >;
  for (const actual of CATEGORIES) {
    matrix[actual] = {} as Record<Category, number>;
    for (const predicted of CATEGORIES) {
      matrix[actual][predicted] = 0;
    }
  }
  return matrix;
}

function accuracy(rows: { actual: Category; predicted: Category }[]) {
  if (rows.length === 0) {
    return 0;
  }
  const hits = rows.filter((row) => row.actual === row.predicted).length;
  return hits / rows.length;
}

function renderMatrix(matrix: Record<Category, Record<Category, number>>) {
  const header = ["actual \\ pred", ...CATEGORIES].join(" | ");
  const divider = Array.from({ length: CATEGORIES.length + 1 }, () => "---").join(" | ");
  const body = CATEGORIES.map((actual) => {
    const cells = CATEGORIES.map((predicted) => String(matrix[actual][predicted]));
    return [actual, ...cells].join(" | ");
  });
  return [header, divider, ...body].join("\n");
}

async function loadPersistedPredictions(): Promise<{
  userId: string;
  categories: Map<string, Category>;
} | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const { rows: users } = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [DEMO_USER.email],
    );
    const userId = users[0]?.id;
    if (!userId) {
      return null;
    }

    const { rows } = await query<{ plaid_transaction_id: string | null; category: string | null }>(
      `SELECT plaid_transaction_id, category
       FROM transactions
       WHERE user_id = $1 AND category IS NOT NULL AND plaid_transaction_id IS NOT NULL`,
      [userId],
    );

    if (rows.length === 0) {
      return { userId, categories: new Map() };
    }

    return {
      userId,
      categories: new Map(
        rows
          .filter((row) => row.plaid_transaction_id && row.category)
          .map((row) => [row.plaid_transaction_id as string, row.category as Category]),
      ),
    };
  } catch {
    return null;
  }
}

async function main() {
  const persisted = await loadPersistedPredictions();
  const generatorUserId = persisted?.userId ?? "accuracy-user";
  const generated = generateMockTransactions(generatorUserId);
  const usedGemini = isGeminiConfigured();
  const usedPersisted = Boolean(persisted && persisted.categories.size > 0);

  const evalRows: EvalRow[] = [];
  for (const txn of generated) {
    const truth = txn.seedCategory ?? seedCategoryForMerchant(txn.merchantName, txn.amount);
    const baseline = ruleBasedCategorize({
      merchantName: txn.merchantName,
      name: txn.name,
      rawDescription: txn.rawDescription,
      amount: txn.amount,
    }).category;

    let predicted: Category;
    if (persisted && persisted.categories.has(txn.plaidTransactionId)) {
      predicted = persisted.categories.get(txn.plaidTransactionId)!;
    } else {
      predicted = (
        await categorizeTransaction({
          merchantName: txn.merchantName,
          name: txn.name,
          rawDescription: txn.rawDescription,
          amount: txn.amount,
        })
      ).category;
    }

    evalRows.push({
      merchantName: txn.merchantName,
      amount: txn.amount,
      truth,
      predicted,
      baseline,
    });
  }

  const vsTruth = emptyMatrix();
  const vsBaseline = emptyMatrix();
  for (const row of evalRows) {
    vsTruth[row.truth][row.predicted] += 1;
    vsBaseline[row.baseline][row.predicted] += 1;
  }

  const truthAcc = accuracy(evalRows.map((row) => ({ actual: row.truth, predicted: row.predicted })));
  const baselineAcc = accuracy(
    evalRows.map((row) => ({ actual: row.baseline, predicted: row.predicted })),
  );
  const baselineVsTruth = accuracy(
    evalRows.map((row) => ({ actual: row.truth, predicted: row.baseline })),
  );

  const source = usedPersisted
    ? "Persisted `transactions.category` for the demo user (from seed / Gemini or mock)."
    : usedGemini
      ? "Live Gemini `gemini-1.5-flash` calls on generated mock merchants."
      : "In-memory keyword MOCK categorizer (GEMINI_API_KEY unset).";

  const markdown = `# Categorization accuracy

Ground truth is the **deterministic seed labels** attached to the mock generator in \`lib/plaid-mock.ts\` (merchant + amount mapping). That is preferred over treating the keyword baseline as truth.

The keyword rule set in \`lib/categories.ts\` is the **baseline**, not ground truth. Rent is labeled \`other\` in seed labels because housing is not in the category enum.

## Run settings

- Rows evaluated: ${evalRows.length}
- Predictor: ${source}
- GEMINI_API_KEY present: ${usedGemini ? "yes" : "no"}
- Compared persisted DB categories: ${usedPersisted ? "yes" : "no"}

## Scores

| Comparison | Accuracy |
| --- | --- |
| Predictor vs seed labels (ground truth) | ${(truthAcc * 100).toFixed(1)}% |
| Predictor vs keyword baseline | ${(baselineAcc * 100).toFixed(1)}% |
| Keyword baseline vs seed labels | ${(baselineVsTruth * 100).toFixed(1)}% |

When \`GEMINI_API_KEY\` is unset, the predictor **is** the keyword mock, so predictor vs baseline is 100%. That does not mean the labels are perfect against seed ground truth.

## Confusion matrix: predictor vs seed labels

${renderMatrix(vsTruth)}

## Confusion matrix: predictor vs keyword baseline

${renderMatrix(vsBaseline)}

## Notes

- Recurring rent / EMI / payroll are generated on a fixed calendar so later forecast work stays reproducible.
- Low-confidence UI highlighting uses \`confidence < 0.6\`; rent's baseline confidence is 0.58 on purpose so that path is visible in MOCK mode.
`;

  const docsDir = path.join(process.cwd(), "docs");
  await mkdir(docsDir, { recursive: true });
  const outPath = path.join(docsDir, "categorization-accuracy.md");
  await writeFile(outPath, markdown, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`Predictor vs seed labels: ${(truthAcc * 100).toFixed(1)}%`);
  console.log(`Predictor vs baseline: ${(baselineAcc * 100).toFixed(1)}%`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
