import { Document } from "@langchain/core/documents";
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import {
  buildTransactionText,
  embedText,
  expandQueryForEmbedding,
  formatVectorLiteral,
  isGeminiConfigured,
} from "./llm";
import { query } from "./db";

export const DEFAULT_RAG_TOP_K = 8;

export function ragTopK(override?: number) {
  if (override && override > 0) {
    return override;
  }
  const fromEnv = Number(process.env.RAG_TOP_K ?? DEFAULT_RAG_TOP_K);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_RAG_TOP_K;
}

export type RetrievedTransaction = {
  id: string;
  occurredOn: string;
  merchantName: string | null;
  category: string | null;
  amount: string;
  rawDescription: string | null;
  content: string;
  similarity: number;
};

type SearchRow = {
  id: string;
  occurred_on: string;
  merchant_name: string | null;
  category: string | null;
  amount: string;
  raw_description: string | null;
  similarity: string;
};

export const USER_SCOPED_VECTOR_SQL = `SELECT id,
            occurred_on::text AS occurred_on,
            merchant_name,
            category,
            amount::text AS amount,
            raw_description,
            (1 - (embedding <=> $2::vector))::text AS similarity
     FROM transactions
     WHERE user_id = $1
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector
     LIMIT $3`;

export function rowsForUser<T extends { userId: string }>(rows: T[], userId: string, k: number) {
  return rows.filter((row) => row.userId === userId).slice(0, k);
}

export async function searchTransactionsByVector(
  userId: string,
  vectorLiteral: string,
  k: number,
): Promise<RetrievedTransaction[]> {
  const { rows } = await query<SearchRow>(USER_SCOPED_VECTOR_SQL, [userId, vectorLiteral, k]);

  return rows.map((row) => {
    const content = buildTransactionText({
      occurredOn: row.occurred_on,
      merchantName: row.merchant_name,
      category: row.category,
      amount: row.amount,
      rawDescription: row.raw_description,
    });
    return {
      id: row.id,
      occurredOn: row.occurred_on,
      merchantName: row.merchant_name,
      category: row.category,
      amount: row.amount,
      rawDescription: row.raw_description,
      content,
      similarity: Number(row.similarity),
    };
  });
}

type RetrieverFields = BaseRetrieverInput & {
  userId: string;
  k?: number;
};

export class UserScopedTransactionRetriever extends BaseRetriever {
  static lc_name() {
    return "UserScopedTransactionRetriever";
  }

  lc_namespace = ["spendsense", "retrievers"];

  private readonly userId: string;
  private readonly k: number;

  constructor(fields: RetrieverFields) {
    const { userId, k, ...rest } = fields;
    super(rest);
    this.userId = userId;
    this.k = ragTopK(k);
  }

  async _getRelevantDocuments(queryText: string): Promise<Document[]> {
    const textToEmbed = isGeminiConfigured()
      ? queryText
      : expandQueryForEmbedding(queryText);
    const vector = await embedText(textToEmbed);
    const matches = await searchTransactionsByVector(
      this.userId,
      formatVectorLiteral(vector),
      this.k,
    );

    return matches.map(
      (match) =>
        new Document({
          pageContent: match.content,
          metadata: {
            id: match.id,
            userId: this.userId,
            occurredOn: match.occurredOn,
            merchantName: match.merchantName,
            category: match.category,
            amount: match.amount,
            rawDescription: match.rawDescription,
            similarity: match.similarity,
          },
        }),
    );
  }
}

export async function retrieveRelevantTransactions(
  userId: string,
  queryText: string,
  k = ragTopK(),
): Promise<RetrievedTransaction[]> {
  const retriever = new UserScopedTransactionRetriever({ userId, k });
  const documents = await retriever.invoke(queryText);

  return documents.map((document) => ({
    id: String(document.metadata.id),
    occurredOn: String(document.metadata.occurredOn ?? ""),
    merchantName: (document.metadata.merchantName as string | null) ?? null,
    category: (document.metadata.category as string | null) ?? null,
    amount: String(document.metadata.amount ?? ""),
    rawDescription: (document.metadata.rawDescription as string | null) ?? null,
    content: document.pageContent,
    similarity: Number(document.metadata.similarity ?? 0),
  }));
}
