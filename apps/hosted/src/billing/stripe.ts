import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function getAllowedPriceIds(): string[] {
  return [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_ANNUAL].filter(
    (id): id is string => Boolean(id)
  );
}

export function isAllowedPriceId(priceId: string): boolean {
  return getAllowedPriceIds().includes(priceId);
}

function requireAbsoluteUrl(url: string | undefined, envName: string): string {
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`${envName} must be an absolute URL`);
  }
  return url;
}

export function billingSuccessUrl(fallbackOrigin?: string): string {
  return requireAbsoluteUrl(
    process.env.BILLING_SUCCESS_URL ??
      (fallbackOrigin ? `${fallbackOrigin}/displays?upgraded=1` : undefined),
    'BILLING_SUCCESS_URL'
  );
}

export function billingCancelUrl(fallbackOrigin?: string): string {
  return requireAbsoluteUrl(
    process.env.BILLING_CANCEL_URL ?? (fallbackOrigin ? `${fallbackOrigin}/displays` : undefined),
    'BILLING_CANCEL_URL'
  );
}

export function buildCheckoutSessionParams(input: {
  userId: string;
  email: string | null;
  stripeCustomerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): {
  mode: 'subscription';
  line_items: Array<{ price: string; quantity: number }>;
  success_url: string;
  cancel_url: string;
  client_reference_id: string;
  metadata: { userId: string };
  subscription_data: { metadata: { userId: string } };
  customer?: string;
  customer_email?: string;
} {
  return {
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    metadata: { userId: input.userId },
    subscription_data: { metadata: { userId: input.userId } },
    ...(input.stripeCustomerId
      ? { customer: input.stripeCustomerId }
      : input.email
        ? { customer_email: input.email }
        : {}),
  };
}

export function rawWebhookBody(event: { body: string | null; isBase64Encoded?: boolean }): string {
  if (!event.body) return '';
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

function isStripeMissingResource(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing'
  );
}

export type AccountDeleteBilling = {
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
};

/** Cancel subscription and remove Stripe customer when a user deletes their account. */
export async function cancelBillingOnAccountDelete(
  stripe: Stripe,
  billing: AccountDeleteBilling
): Promise<void> {
  if (billing.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(billing.stripeSubscriptionId);
    } catch (error) {
      if (!isStripeMissingResource(error)) throw error;
    }
  }

  if (billing.stripeCustomerId) {
    try {
      await stripe.customers.del(billing.stripeCustomerId);
    } catch (error) {
      if (!isStripeMissingResource(error)) throw error;
    }
  }
}
