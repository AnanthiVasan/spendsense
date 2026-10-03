import { query } from "./db";
import { PLAN_LIMITS, type PlanTier } from "./stripe";

export type SubscriptionRecord = {
  tier: PlanTier;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
};

const FREE_SUBSCRIPTION: SubscriptionRecord = {
  tier: "free",
  status: "active",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
};

export async function getUserSubscription(userId: string): Promise<SubscriptionRecord> {
  const { rows } = await query<{
    tier: PlanTier;
    status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
  }>(
    `SELECT tier, status, stripe_customer_id, stripe_subscription_id,
            current_period_end::text AS current_period_end
     FROM subscriptions
     WHERE user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) {
    return FREE_SUBSCRIPTION;
  }
  return {
    tier: row.tier === "pro" ? "pro" : "free",
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end,
  };
}

export function tierFromRecord(record: Pick<SubscriptionRecord, "tier" | "status">): PlanTier {
  if (record.tier !== "pro") {
    return "free";
  }
  if (record.status === "active" || record.status === "trialing") {
    return "pro";
  }
  return "free";
}

export async function getUserTier(userId: string): Promise<PlanTier> {
  return tierFromRecord(await getUserSubscription(userId));
}

export async function upsertSubscriptionFromStripe(input: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  tier: PlanTier;
  status: string;
  currentPeriodEnd?: Date | null;
}) {
  await query(
    `INSERT INTO subscriptions (
       user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_end, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       tier = EXCLUDED.tier,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = now()`,
    [
      input.userId,
      input.stripeCustomerId ?? null,
      input.stripeSubscriptionId ?? null,
      input.tier,
      input.status,
      input.currentPeriodEnd ?? null,
    ],
  );
}

export async function findUserIdByStripeCustomer(customerId: string) {
  const { rows } = await query<{ user_id: string }>(
    `SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  );
  return rows[0]?.user_id ?? null;
}

export function copilotDailyLimit(tier: PlanTier) {
  return PLAN_LIMITS[tier].copilotQueriesPerDay;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export class CopilotQuotaError extends Error {
  constructor() {
    super("Upgrade to Pro");
    this.name = "CopilotQuotaError";
  }
}

export async function getCopilotUsage(userId: string) {
  const tier = await getUserTier(userId);
  const limit = copilotDailyLimit(tier);
  const { rows } = await query<{ copilot_count: number }>(
    `SELECT copilot_count FROM usage WHERE user_id = $1 AND day = $2::date`,
    [userId, utcDay()],
  );
  return { used: rows[0]?.copilot_count ?? 0, limit, tier };
}

export async function enforceCopilotQuota(userId: string) {
  const usage = await getCopilotUsage(userId);
  if (usage.limit !== null && usage.used >= usage.limit) {
    throw new CopilotQuotaError();
  }
  await query(
    `INSERT INTO usage (user_id, day, copilot_count)
     VALUES ($1, $2::date, 1)
     ON CONFLICT (user_id, day)
     DO UPDATE SET copilot_count = usage.copilot_count + 1`,
    [userId, utcDay()],
  );
}
