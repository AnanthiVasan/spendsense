import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { upsertSubscriptionFromStripe } from "@/lib/subscription";
import { appBaseUrl, getStripe, isStripeMockMode } from "@/lib/stripe";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST() {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  if (isStripeMockMode()) {
    return NextResponse.json({ url: `${appBaseUrl()}/api/stripe/mock-success` });
  }

  const price = process.env.STRIPE_PRICE_ID_PRO;
  if (!price) {
    return NextResponse.json({ error: "STRIPE_PRICE_ID_PRO is not set" }, { status: 500 });
  }

  const { rows } = await query<{ email: string; stripe_customer_id: string | null }>(
    `SELECT u.email, s.stripe_customer_id
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.id = $1`,
    [authz.userId],
  );
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const stripe = getStripe();
  const customerId =
    user.stripe_customer_id ??
    (
      await stripe.customers.create({
        email: user.email,
        metadata: { userId: authz.userId },
      })
    ).id;

  await upsertSubscriptionFromStripe({
    userId: authz.userId,
    stripeCustomerId: customerId,
    tier: "free",
    status: "active",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: authz.userId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appBaseUrl()}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl()}/billing?canceled=1`,
    metadata: { userId: authz.userId },
    subscription_data: { metadata: { userId: authz.userId } },
  });

  return NextResponse.json({ url: session.url });
}
