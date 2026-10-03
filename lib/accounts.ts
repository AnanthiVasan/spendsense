import { query } from "./db";
import { isPlaidMockMode } from "./plaid";

export type SafeAccount = {
  id: string;
  name: string;
  mask: string | null;
  institutionName: string | null;
};

export type SafeTransaction = {
  id: string;
  occurredOn: string;
  merchantName: string | null;
  amount: string;
  pending: boolean;
  accountName: string | null;
  category: string | null;
  confidence: number | null;
  anomalyReason: string | null;
  anomalyZScore: number | null;
};

export async function listLinkedAccounts(userId: string): Promise<SafeAccount[]> {
  const { rows } = await query<{
    id: string;
    name: string;
    mask: string | null;
    institution_name: string | null;
  }>(
    `SELECT id, name, mask, institution_name
     FROM accounts
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mask: row.mask,
    institutionName: row.institution_name,
  }));
}

export async function listTransactions(userId: string, limit = 100): Promise<SafeTransaction[]> {
  const { rows } = await query<{
    id: string;
    occurred_on: string;
    merchant_name: string | null;
    amount: string;
    pending: boolean;
    account_name: string | null;
    category: string | null;
    confidence: string | null;
    anomaly_reason: string | null;
    anomaly_z_score: string | null;
  }>(
    `SELECT t.id,
            t.occurred_on::text AS occurred_on,
            t.merchant_name,
            t.amount::text AS amount,
            t.pending,
            a.name AS account_name,
            t.category,
            t.confidence::text AS confidence,
            al.reason AS anomaly_reason,
            al.z_score::text AS anomaly_z_score
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN alerts al ON al.transaction_id = t.id AND al.user_id = t.user_id
     WHERE t.user_id = $1
     ORDER BY t.occurred_on DESC, t.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    merchantName: row.merchant_name,
    amount: row.amount,
    pending: row.pending,
    accountName: row.account_name,
    category: row.category,
    confidence: row.confidence === null ? null : Number(row.confidence),
    anomalyReason: row.anomaly_reason,
    anomalyZScore: row.anomaly_z_score === null ? null : Number(row.anomaly_z_score),
  }));
}

export async function monthSpend(userId: string): Promise<number> {
  const { rows } = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM transactions
     WHERE user_id = $1
       AND amount > 0
       AND occurred_on >= date_trunc('month', CURRENT_DATE)::date`,
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export function plaidUiState() {
  return { mock: isPlaidMockMode() };
}
