import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-09-30.endive" as Stripe.LatestApiVersion;

export const PLAN_LIMITS = {
  free: { copilotQueriesPerDay: 10 },
  pro: { copilotQueriesPerDay: null },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

export function isStripeMockMode() {
  return !process.env.STRIPE_SECRET_KEY;
}

export function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
}

let client: Stripe | undefined;

export function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });
  }
  return client;
}
