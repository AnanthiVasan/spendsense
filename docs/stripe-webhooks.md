# Stripe webhooks

`POST /api/stripe/webhook` is public. It reads the raw body with `request.text()` and verifies `Stripe-Signature` using `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`. The parsed JSON body is not used for verification.

When `STRIPE_SECRET_KEY` is unset, verification is skipped and a warning is logged. That path exists so local mock checkout can still write the same `subscriptions` row. Real test mode must set the webhook secret.

## Events

| Event | Effect |
|---|---|
| `checkout.session.completed` | Pro, status `active`. User id comes from `client_reference_id` or `metadata.userId`. |
| `customer.subscription.created` | Sync tier, status, and `current_period_end`. |
| `customer.subscription.updated` | Same sync. `past_due` stays stored as pro status `past_due`. |
| `customer.subscription.deleted` | Tier `free`, status `canceled`. |
| `invoice.payment_failed` | Status `past_due`. |

Other event types are logged and answered with HTTP 200.

## What the UI treats as Pro

`tierFromRecord` returns **pro** only when the stored tier is `pro` and status is `active` or `trialing`. `past_due`, `canceled`, and any free row are **free**. The client never writes tier except the mock success route, which returns 404 when a Stripe secret is configured.

## Local forwarding

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` value into `STRIPE_WEBHOOK_SECRET`. The test price id goes in `STRIPE_PRICE_ID_PRO` and the test secret key in `STRIPE_SECRET_KEY`.
