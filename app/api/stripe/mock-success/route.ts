import { NextResponse } from "next/server";
import { upsertSubscriptionFromStripe } from "@/lib/subscription";
import { appBaseUrl, isStripeMockMode } from "@/lib/stripe";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  if (!isStripeMockMode()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  await upsertSubscriptionFromStripe({
    userId: authz.userId,
    tier: "pro",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return NextResponse.redirect(`${appBaseUrl()}/billing?upgraded=1`);
}
