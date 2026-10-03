import {
  buildTransactionText,
  embedBatch,
  formatVectorLiteral,
  isGeminiConfigured,
} from "./llm";
import { query } from "./db";

const UPDATE_CHUNK = 16;

type UnembeddedRow = {
  id: string;
  occurred_on: string;
  merchant_name: string | null;
  category: string | null;
  amount: string;
  raw_description: string | null;
};

export async function embedTransactionsForUser(userId: string) {
  const { rows } = await query<UnembeddedRow>(
    `SELECT id,
            occurred_on::text AS occurred_on,
            merchant_name,
            category,
            amount::text AS amount,
            raw_description
     FROM transactions
     WHERE user_id = $1
       AND embedding IS NULL
     ORDER BY occurred_on ASC`,
    [userId],
  );

  let embedded = 0;

  for (let i = 0; i < rows.length; i += UPDATE_CHUNK) {
    const chunk = rows.slice(i, i + UPDATE_CHUNK);
    const texts = chunk.map((row) =>
      buildTransactionText({
        occurredOn: row.occurred_on,
        merchantName: row.merchant_name,
        category: row.category,
        amount: row.amount,
        rawDescription: row.raw_description,
      }),
    );
    const vectors = await embedBatch(texts);

    for (let j = 0; j < chunk.length; j += 1) {
      await query(
        `UPDATE transactions
         SET embedding = $1::vector
         WHERE id = $2
           AND user_id = $3
           AND embedding IS NULL`,
        [formatVectorLiteral(vectors[j]), chunk[j].id, userId],
      );
      embedded += 1;
    }
  }

  if (embedded > 0) {
    await query(`ANALYZE transactions`);
  }

  return {
    scanned: rows.length,
    embedded,
    mock: !isGeminiConfigured(),
  };
}
