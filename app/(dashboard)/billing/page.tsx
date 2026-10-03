import { BillingActions } from "@/components/BillingActions";
import { PLAN_LIMITS } from "@/lib/stripe";
import { getCopilotUsage, getUserSubscription, getUserTier } from "@/lib/subscription";
import { auth } from "@/lib/auth";

export default async function BillingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  let subscription: Awaited<ReturnType<typeof getUserSubscription>> = {
    tier: "free",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
  };
  let effectiveTier: "free" | "pro" = "free";
  let usage = { used: 0, limit: PLAN_LIMITS.free.copilotQueriesPerDay as number | null };
  let dbError: string | null = null;

  try {
    const [stored, tier, copilot] = await Promise.all([
      getUserSubscription(userId),
      getUserTier(userId),
      getCopilotUsage(userId),
    ]);
    subscription = stored;
    effectiveTier = tier;
    usage = { used: copilot.used, limit: copilot.limit };
  } catch {
    dbError = "Apply db/migrations/007_subscriptions_usage.sql before using billing.";
  }

  const limitLabel =
    usage.limit === null ? "unlimited" : `${usage.used}/${usage.limit} queries used today`;

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-2 text-slate-400">
        Effective tier is {effectiveTier}. Stored status is {subscription.status}.
      </p>
      {dbError ? <p className="mt-3 text-sm text-amber-300">{dbError}</p> : null}
      <p className="mt-4 text-sm text-slate-300">Copilot: {limitLabel}</p>
      {effectiveTier === "pro" && subscription.currentPeriodEnd ? (
        <p className="mt-2 text-sm text-slate-400">
          Current period ends {subscription.currentPeriodEnd.slice(0, 10)}.
        </p>
      ) : null}
      <div className="mt-6">
        <BillingActions tier={effectiveTier} />
      </div>
    </section>
  );
}
