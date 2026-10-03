import { NextResponse } from "next/server";
import { getUserSubscription } from "@/lib/subscription";
import { appBaseUrl, getStripe, isStripeMockMode } from "@/lib/stripe";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST() {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  if (isStripeMockMode()) {
    return NextResponse.json({
      url: `${appBaseUrl()}/billing`,
      mock: true,
      message: "Stripe Customer Portal is skipped in MOCK mode.",
    });
  }

  const subscription = await getUserSubscription(authz.userId);
  if (!subscription.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer yet" }, { status: 400 });
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appBaseUrl()}/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
