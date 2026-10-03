import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type Transaction,
  type RemovedTransaction,
} from "plaid";
import { query } from "./db";
import {
  generateMockTransactions,
  mockExchange,
  mockLinkToken,
} from "./plaid-mock";

export type PlaidLinkTokenResult = {
  linkToken: string;
  expiration: string;
  mock: boolean;
};

export type PlaidExchangeResult = {
  itemId: string;
  institutionName: string;
  mock: boolean;
};

export type PlaidSyncResult = {
  added: number;
  modified: number;
  removed: number;
  mock: boolean;
};

const MAX_SYNC_PAGES = 5;
const SYNC_PAGE_SIZE = 100;

type LinkedItem = {
  plaid_item_id: string;
  plaid_access_token: string;
  sync_cursor: string | null;
};

type AccountRow = {
  id: string;
  plaid_account_id: string | null;
};

function plaidEnv() {
  const env = process.env.PLAID_ENV ?? "sandbox";
  return PlaidEnvironments[env as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox;
}

export function isPlaidMockMode() {
  return !process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET;
}

let plaidApi: PlaidApi | undefined;

export function getPlaidApi(): PlaidApi {
  if (isPlaidMockMode()) {
    throw new Error("Plaid is running in MOCK mode; no live client is configured.");
  }

  if (!plaidApi) {
    plaidApi = new PlaidApi(
      new Configuration({
        basePath: plaidEnv(),
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
          },
        },
      }),
    );
  }

  return plaidApi;
}

export async function createLinkToken(userId: string): Promise<PlaidLinkTokenResult> {
  if (isPlaidMockMode()) {
    const token = mockLinkToken();
    return { ...token, mock: true };
  }

  const client = getPlaidApi();
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Spendsense",
    language: "en",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    transactions: { days_requested: 90 },
  });

  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
    mock: false,
  };
}

export async function exchangePublicToken(
  userId: string,
  publicToken: string,
): Promise<PlaidExchangeResult> {
  if (isPlaidMockMode()) {
    const mock = mockExchange(userId);
    await persistAccounts({
      userId,
      itemId: mock.itemId,
      accessToken: mock.accessToken,
      institutionName: mock.institutionName,
      accounts: mock.accounts.map((account) => ({
        plaidAccountId: account.plaidAccountId,
        name: account.name,
        officialName: account.officialName,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
      })),
    });
    return {
      itemId: mock.itemId,
      institutionName: mock.institutionName,
      mock: true,
    };
  }

  const client = getPlaidApi();
  const exchanged = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchanged.data.access_token;
  const itemId = exchanged.data.item_id;

  const item = await client.itemGet({ access_token: accessToken });
  const institutionId = item.data.item.institution_id;
  let institutionName = "Linked institution";
  if (institutionId) {
    const institution = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });
    institutionName = institution.data.institution.name;
  }

  const accountsResponse = await client.accountsGet({ access_token: accessToken });
  await persistAccounts({
    userId,
    itemId,
    accessToken,
    institutionName,
    accounts: accountsResponse.data.accounts.map((account) => ({
      plaidAccountId: account.account_id,
      name: account.name,
      officialName: account.official_name ?? account.name,
      type: account.type,
      subtype: account.subtype ?? null,
      mask: account.mask ?? null,
    })),
  });

  return { itemId, institutionName, mock: false };
}

export async function syncTransactions(userId: string): Promise<PlaidSyncResult> {
  if (isPlaidMockMode()) {
    return syncMockTransactions(userId);
  }

  const { rows: items } = await query<LinkedItem>(
    `SELECT DISTINCT plaid_item_id, plaid_access_token, sync_cursor
     FROM accounts
     WHERE user_id = $1
       AND plaid_access_token IS NOT NULL
       AND plaid_item_id IS NOT NULL`,
    [userId],
  );

  let added = 0;
  let modified = 0;
  let removed = 0;

  for (const item of items) {
    const result = await syncPlaidItem(userId, item);
    added += result.added;
    modified += result.modified;
    removed += result.removed;
  }

  return { added, modified, removed, mock: false };
}

async function syncMockTransactions(userId: string): Promise<PlaidSyncResult> {
  const generated = generateMockTransactions(userId);
  const accountMap = await loadAccountMap(userId);
  let added = 0;

  for (const transaction of generated) {
    const accountId = accountMap.get(transaction.plaidAccountId);
    if (!accountId) {
      continue;
    }
    const inserted = await upsertTransaction(userId, accountId, {
      plaidTransactionId: transaction.plaidTransactionId,
      amount: transaction.amount,
      merchantName: transaction.merchantName,
      name: transaction.name,
      rawDescription: transaction.rawDescription,
      occurredOn: transaction.occurredOn,
      pending: transaction.pending,
    });
    if (inserted) {
      added += 1;
    }
  }

  return { added, modified: 0, removed: 0, mock: true };
}

async function syncPlaidItem(userId: string, item: LinkedItem): Promise<PlaidSyncResult> {
  const client = getPlaidApi();
  const accountMap = await loadAccountMap(userId);
  let cursor = item.sync_cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let pages = 0;
  let hasMore = true;

  try {
    while (hasMore && pages < MAX_SYNC_PAGES) {
      const response = await client.transactionsSync({
        access_token: item.plaid_access_token,
        cursor,
        count: SYNC_PAGE_SIZE,
      });

      for (const transaction of response.data.added) {
        const upserted = await persistPlaidTransaction(userId, accountMap, transaction);
        if (upserted) {
          added += 1;
        }
      }
      for (const transaction of response.data.modified) {
        const upserted = await persistPlaidTransaction(userId, accountMap, transaction);
        if (upserted) {
          modified += 1;
        }
      }
      for (const transaction of response.data.removed) {
        await removePlaidTransaction(userId, transaction);
        removed += 1;
      }

      cursor = response.data.next_cursor;
      hasMore = response.data.has_more;
      pages += 1;
    }
  } catch {
    const fallback = await syncWithTransactionsGet(userId, item.plaid_access_token, accountMap);
    added += fallback.added;
    modified += fallback.modified;
  }

  if (cursor) {
    await query(
      `UPDATE accounts
       SET sync_cursor = $1
       WHERE user_id = $2 AND plaid_item_id = $3`,
      [cursor, userId, item.plaid_item_id],
    );
  }

  return { added, modified, removed, mock: false };
}

async function syncWithTransactionsGet(
  userId: string,
  accessToken: string,
  accountMap: Map<string, string>,
) {
  const client = getPlaidApi();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setUTCDate(endDate.getUTCDate() - 90);

  const format = (date: Date) => date.toISOString().slice(0, 10);
  let offset = 0;
  let added = 0;
  let pages = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total && pages < MAX_SYNC_PAGES) {
    const response = await client.transactionsGet({
      access_token: accessToken,
      start_date: format(startDate),
      end_date: format(endDate),
      options: { count: SYNC_PAGE_SIZE, offset },
    });
    total = response.data.total_transactions;
    for (const transaction of response.data.transactions) {
      const upserted = await persistPlaidTransaction(userId, accountMap, transaction);
      if (upserted) {
        added += 1;
      }
    }
    offset += response.data.transactions.length;
    pages += 1;
  }

  return { added, modified: 0 };
}

async function persistPlaidTransaction(
  userId: string,
  accountMap: Map<string, string>,
  transaction: Transaction,
) {
  const accountId = accountMap.get(transaction.account_id);
  if (!accountId) {
    return false;
  }

  return upsertTransaction(userId, accountId, {
    plaidTransactionId: transaction.transaction_id,
    amount: transaction.amount,
    merchantName: transaction.merchant_name ?? transaction.name,
    name: transaction.name,
    rawDescription: transaction.original_description ?? transaction.name,
    occurredOn: transaction.date,
    pending: transaction.pending,
  });
}

async function removePlaidTransaction(userId: string, transaction: RemovedTransaction) {
  if (!transaction.transaction_id) {
    return;
  }
  await query(
    `DELETE FROM transactions
     WHERE user_id = $1 AND plaid_transaction_id = $2`,
    [userId, transaction.transaction_id],
  );
}

async function persistAccounts(input: {
  userId: string;
  itemId: string;
  accessToken: string;
  institutionName: string;
  accounts: {
    plaidAccountId: string;
    name: string;
    officialName: string | null;
    type: string;
    subtype: string | null;
    mask: string | null;
  }[];
}) {
  for (const account of input.accounts) {
    await query(
      `INSERT INTO accounts (
         user_id, name, official_name, type, subtype, mask,
         plaid_account_id, plaid_item_id, plaid_access_token, institution_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (plaid_account_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         official_name = EXCLUDED.official_name,
         type = EXCLUDED.type,
         subtype = EXCLUDED.subtype,
         mask = EXCLUDED.mask,
         plaid_item_id = EXCLUDED.plaid_item_id,
         plaid_access_token = EXCLUDED.plaid_access_token,
         institution_name = EXCLUDED.institution_name
       WHERE accounts.user_id = $1`,
      [
        input.userId,
        account.name,
        account.officialName,
        account.type,
        account.subtype,
        account.mask,
        account.plaidAccountId,
        input.itemId,
        input.accessToken,
        input.institutionName,
      ],
    );
  }
}

async function loadAccountMap(userId: string) {
  const { rows } = await query<AccountRow>(
    `SELECT id, plaid_account_id
     FROM accounts
     WHERE user_id = $1 AND plaid_account_id IS NOT NULL`,
    [userId],
  );
  return new Map(
    rows
      .filter((row) => row.plaid_account_id)
      .map((row) => [row.plaid_account_id as string, row.id]),
  );
}

async function upsertTransaction(
  userId: string,
  accountId: string,
  transaction: {
    plaidTransactionId: string;
    amount: number;
    merchantName: string;
    name: string;
    rawDescription: string;
    occurredOn: string;
    pending: boolean;
  },
) {
  const result = await query(
    `INSERT INTO transactions (
       user_id, account_id, amount, merchant_name, name, raw_description,
       occurred_on, pending, plaid_transaction_id, category, subcategory,
       confidence, embedding
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, NULL, NULL)
     ON CONFLICT (plaid_transaction_id)
     DO UPDATE SET
       amount = EXCLUDED.amount,
       merchant_name = EXCLUDED.merchant_name,
       name = EXCLUDED.name,
       raw_description = EXCLUDED.raw_description,
       occurred_on = EXCLUDED.occurred_on,
       pending = EXCLUDED.pending
     WHERE transactions.user_id = $1
     RETURNING (xmax = 0) AS inserted`,
    [
      userId,
      accountId,
      transaction.amount,
      transaction.merchantName,
      transaction.name,
      transaction.rawDescription,
      transaction.occurredOn,
      transaction.pending,
      transaction.plaidTransactionId,
    ],
  );

  return Boolean(result.rows[0] && (result.rows[0] as { inserted: boolean }).inserted);
}

export async function provisionMockBankData(userId: string) {
  const mock = mockExchange(userId);
  await persistAccounts({
    userId,
    itemId: mock.itemId,
    accessToken: mock.accessToken,
    institutionName: mock.institutionName,
    accounts: mock.accounts.map((account) => ({
      plaidAccountId: account.plaidAccountId,
      name: account.name,
      officialName: account.officialName,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
    })),
  });
  return syncMockTransactions(userId);
}
