import type Stripe from "stripe";
import { findUserIdByStripeCustomer, upsertSubscriptionFromStripe } from "./subscription";
import { getStripe, isStripeMockMode } from "./stripe";

function periodEnd(subscription: Stripe.Subscription) {
  const fromRoot = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  const seconds = fromRoot ?? fromItem;
  return seconds ? new Date(seconds * 1000) : null;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function applyStripeEvent(event: { type: string; data: { object: unknown } }) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;
      if (!userId) {
        console.warn("checkout.session.completed missing user id");
        return;
      }
      await upsertSubscriptionFromStripe({
        userId,
        stripeCustomerId: customerId(session.customer),
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
        tier: "pro",
        status: "active",
      });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId =
        subscription.metadata?.userId ||
        (await findUserIdByStripeCustomer(customerId(subscription.customer) ?? ""));
      if (!userId) {
        console.warn(`${event.type} could not be mapped to a user`);
        return;
      }
      const status = subscription.status;
      const tier = status === "canceled" || status === "unpaid" || status === "incomplete_expired" ? "free" : "pro";
      await upsertSubscriptionFromStripe({
        userId,
        stripeCustomerId: customerId(subscription.customer),
        stripeSubscriptionId: subscription.id,
        tier,
        status,
        currentPeriodEnd: periodEnd(subscription),
      });
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId =
        subscription.metadata?.userId ||
        (await findUserIdByStripeCustomer(customerId(subscription.customer) ?? ""));
      if (!userId) return;
      await upsertSubscriptionFromStripe({
        userId,
        stripeCustomerId: customerId(subscription.customer),
        stripeSubscriptionId: subscription.id,
        tier: "free",
        status: "canceled",
        currentPeriodEnd: periodEnd(subscription),
      });
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customer = customerId(invoice.customer);
      const userId = customer ? await findUserIdByStripeCustomer(customer) : null;
      if (!userId) return;
      await upsertSubscriptionFromStripe({
        userId,
        stripeCustomerId: customer,
        tier: "pro",
        status: "past_due",
      });
      return;
    }
    default:
      console.info(`Unhandled Stripe event type: ${event.type}`);
  }
}

export async function constructStripeEvent(payload: string, signature: string | null) {
  if (isStripeMockMode()) {
    console.warn("Stripe webhook signature verification bypassed (MOCK mode: STRIPE_SECRET_KEY is unset).");
    return JSON.parse(payload) as Stripe.Event;
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) {
    throw new Error("Missing Stripe webhook signature");
  }
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}
