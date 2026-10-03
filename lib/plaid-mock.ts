import { seedCategoryForMerchant, type Category } from "./categories";

/** Fixed seed so mock merchants, dates, and amounts never drift between runs. */
export const MOCK_PLAID_SEED = 0x51a1d5e5;

/** Inclusive end date for the 90-day mock window (UTC). */
export const MOCK_WINDOW_END = "2026-10-01";
export const MOCK_WINDOW_DAYS = 90;

export const MOCK_INSTITUTION_NAME = "First Platypus Bank";
export const MOCK_PUBLIC_TOKEN = "public-sandbox-mock-token";
export const MOCK_LINK_TOKEN = "link-sandbox-mock-token";
export type MockAccount = {
  plaidAccountId: string;
  name: string;
  officialName: string;
  type: string;
  subtype: string;
  mask: string;
};

export type MockTransaction = {
  plaidTransactionId: string;
  plaidAccountId: string;
  amount: number;
  merchantName: string;
  name: string;
  rawDescription: string;
  occurredOn: string;
  pending: boolean;
  seedCategory: Category;
};

const MERCHANTS = [
  { name: "Starbucks", min: 4.35, max: 12.8 },
  { name: "Whole Foods Market", min: 18.2, max: 94.5 },
  { name: "Uber", min: 9.4, max: 28.75 },
  { name: "Amazon", min: 12.99, max: 86.4 },
  { name: "Netflix", min: 15.49, max: 15.49 },
  { name: "Spotify", min: 11.99, max: 11.99 },
  { name: "Shell Gas", min: 32.1, max: 68.9 },
  { name: "Trader Joe's", min: 14.5, max: 62.3 },
  { name: "Chipotle", min: 11.25, max: 19.8 },
  { name: "Apple", min: 2.99, max: 14.99 },
  { name: "Comcast", min: 89.99, max: 89.99 },
  { name: "PG&E", min: 64.2, max: 142.8 },
  { name: "CVS Pharmacy", min: 8.4, max: 36.7 },
  { name: "Target", min: 16.5, max: 78.2 },
  { name: "Delta Air Lines", min: 186.0, max: 412.0 },
] as const;

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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function addUtcDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mockAccountsForUser(userId: string): MockAccount[] {
  return [
    {
      plaidAccountId: `mock_${userId}_depository_checking`,
      name: "Plaid Checking",
      officialName: "Plaid Gold Standard 0% Interest Checking",
      type: "depository",
      subtype: "checking",
      mask: "0000",
    },
    {
      plaidAccountId: `mock_${userId}_credit_card`,
      name: "Plaid Credit Card",
      officialName: "Plaid Diamond 12.5% APR Interest Credit Card",
      type: "credit",
      subtype: "credit card",
      mask: "3333",
    },
  ];
}

export function generateMockTransactions(userId: string): MockTransaction[] {
  const rand = mulberry32(MOCK_PLAID_SEED);
  const accounts = mockAccountsForUser(userId);
  const start = addUtcDays(MOCK_WINDOW_END, -(MOCK_WINDOW_DAYS - 1));
  const transactions: MockTransaction[] = [];
  let index = 0;

  for (let day = 0; day < MOCK_WINDOW_DAYS; day += 1) {
    const occurredOn = addUtcDays(start, day);
    const count = Math.floor(rand() * 3);

    for (let i = 0; i < count; i += 1) {
      const merchant = MERCHANTS[Math.floor(rand() * MERCHANTS.length)];
      const amount = round2(merchant.min + rand() * (merchant.max - merchant.min));
      const account = accounts[index % accounts.length];
      const plaidTransactionId = `mock_${userId}_txn_${String(index).padStart(4, "0")}`;

      transactions.push({
        plaidTransactionId,
        plaidAccountId: account.plaidAccountId,
        amount,
        merchantName: merchant.name,
        name: merchant.name,
        rawDescription: merchant.name.toUpperCase(),
        occurredOn,
        pending: false,
        seedCategory: seedCategoryForMerchant(merchant.name, amount),
      });
      index += 1;
    }

    if (day === 0 || day === 30 || day === 60) {
      const rentAmount = 2100;
      const checking = accounts[0];
      transactions.push({
        plaidTransactionId: `mock_${userId}_txn_${String(index).padStart(4, "0")}`,
        plaidAccountId: checking.plaidAccountId,
        amount: rentAmount,
        merchantName: "Urban Living Apts",
        name: "Urban Living Apts",
        rawDescription: "URBAN LIVING APTS RENT",
        occurredOn,
        pending: false,
        seedCategory: seedCategoryForMerchant("Urban Living Apts", rentAmount),
      });
      index += 1;
    }

    if (day === 2 || day === 32 || day === 62) {
      const emiAmount = 425;
      const credit = accounts[1];
      transactions.push({
        plaidTransactionId: `mock_${userId}_txn_${String(index).padStart(4, "0")}`,
        plaidAccountId: credit.plaidAccountId,
        amount: emiAmount,
        merchantName: "SoFi Personal Loan",
        name: "SoFi Personal Loan",
        rawDescription: "SOFI PERSONAL LOAN EMI",
        occurredOn,
        pending: false,
        seedCategory: seedCategoryForMerchant("SoFi Personal Loan", emiAmount),
      });
      index += 1;
    }

    if (day % 14 === 0) {
      const payrollAmount = round2(-1850 - rand() * 250);
      const checking = accounts[0];
      const plaidTransactionId = `mock_${userId}_txn_${String(index).padStart(4, "0")}`;
      transactions.push({
        plaidTransactionId,
        plaidAccountId: checking.plaidAccountId,
        amount: payrollAmount,
        merchantName: "Acme Payroll",
        name: "Acme Payroll",
        rawDescription: "ACME PAYROLL DIRECT DEP",
        occurredOn,
        pending: false,
        seedCategory: seedCategoryForMerchant("Acme Payroll", payrollAmount),
      });
      index += 1;
    }
  }

  const credit = accounts[1];
  const outliers: MockTransaction[] = [
    {
      plaidTransactionId: `mock_${userId}_txn_outlier_travel`,
      plaidAccountId: credit.plaidAccountId,
      amount: 2480,
      merchantName: "Delta Air Lines",
      name: "Delta Air Lines",
      rawDescription: "DELTA FIRST CLASS JFK-LHR",
      occurredOn: "2026-09-18",
      pending: false,
      seedCategory: "travel",
    },
    {
      plaidTransactionId: `mock_${userId}_txn_outlier_shopping`,
      plaidAccountId: credit.plaidAccountId,
      amount: 1899,
      merchantName: "Amazon",
      name: "Amazon",
      rawDescription: "AMAZON ELECTRONICS OUTLIER",
      occurredOn: "2026-08-22",
      pending: false,
      seedCategory: "shopping",
    },
    {
      plaidTransactionId: `mock_${userId}_txn_outlier_food`,
      plaidAccountId: credit.plaidAccountId,
      amount: 420,
      merchantName: "Chipotle",
      name: "Chipotle",
      rawDescription: "CHIPOTLE CATERING OUTLIER",
      occurredOn: "2026-07-30",
      pending: false,
      seedCategory: "food",
    },
  ];

  return [...transactions, ...outliers];
}

export function mockLinkToken() {
  return {
    linkToken: MOCK_LINK_TOKEN,
    expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

export function mockExchange(userId: string) {
  return {
    itemId: `mock-item-${userId}`,
    accessToken: `access-sandbox-mock-${userId}`,
    institutionName: MOCK_INSTITUTION_NAME,
    accounts: mockAccountsForUser(userId),
  };
}
