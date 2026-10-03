import { NextResponse } from "next/server";
import { applyStripeEvent, constructStripeEvent } from "@/lib/stripe-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const event = await constructStripeEvent(payload, signature);
    await applyStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
