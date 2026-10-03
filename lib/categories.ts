export const CATEGORIES = [
  "food",
  "travel",
  "utilities",
  "EMI",
  "groceries",
  "entertainment",
  "income",
  "health",
  "shopping",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export type CategorizeInput = {
  merchantName?: string | null;
  name?: string | null;
  rawDescription?: string | null;
  amount: number;
};

export type CategorizeResult = {
  category: Category;
  confidence: number;
};

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: string): value is Category {
  return CATEGORY_SET.has(value);
}

export function normalizeMerchant(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const SEED_LABELS: Record<string, Category> = {
  starbucks: "food",
  chipotle: "food",
  "whole foods market": "groceries",
  "trader joe's": "groceries",
  uber: "travel",
  "shell gas": "travel",
  "delta air lines": "travel",
  comcast: "utilities",
  "pg&e": "utilities",
  netflix: "entertainment",
  spotify: "entertainment",
  amazon: "shopping",
  target: "shopping",
  apple: "shopping",
  "cvs pharmacy": "health",
  "acme payroll": "income",
  "urban living apts": "other",
  "sofi personal loan": "EMI",
};

const RULES: { pattern: RegExp; category: Category; confidence: number }[] = [
  { pattern: /\b(payroll|salary|direct dep|paycheck|acme)\b/i, category: "income", confidence: 0.96 },
  { pattern: /\b(sofi|emi|loan|equated|installment)\b/i, category: "EMI", confidence: 0.93 },
  { pattern: /\b(starbucks|chipotle|mcdonald|restaurant|cafe|dunkin)\b/i, category: "food", confidence: 0.9 },
  { pattern: /\b(whole foods|trader joe|kroger|safeway|grocery)\b/i, category: "groceries", confidence: 0.92 },
  { pattern: /\b(uber|lyft|delta|united|airlines|shell gas|exxon|chevron)\b/i, category: "travel", confidence: 0.88 },
  { pattern: /\b(comcast|pg&e|pge|utility|electric|internet|verizon)\b/i, category: "utilities", confidence: 0.91 },
  { pattern: /\b(netflix|spotify|hulu|disney\+|hbo)\b/i, category: "entertainment", confidence: 0.94 },
  { pattern: /\b(cvs|walgreens|pharmacy|hospital|doctor|clinic)\b/i, category: "health", confidence: 0.87 },
  { pattern: /\b(amazon|target|walmart|apple|best buy)\b/i, category: "shopping", confidence: 0.84 },
  { pattern: /\b(rent|landlord|apts|apartment)\b/i, category: "other", confidence: 0.58 },
];

export function seedCategoryForMerchant(merchantName: string, amount: number): Category {
  if (amount < 0) {
    return "income";
  }
  const key = normalizeMerchant(merchantName);
  return SEED_LABELS[key] ?? "other";
}

export function ruleBasedCategorize(input: CategorizeInput): CategorizeResult {
  if (input.amount < 0) {
    return { category: "income", confidence: 0.97 };
  }

  const haystack = [input.merchantName, input.name, input.rawDescription]
    .filter(Boolean)
    .join(" ");

  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }

  return { category: "other", confidence: 0.34 };
}
