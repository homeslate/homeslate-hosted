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

export function billingSuccessUrl(fallbackOrigin?: string): string {
  return (
    process.env.BILLING_SUCCESS_URL ??
    (fallbackOrigin ? `${fallbackOrigin}/displays?upgraded=1` : '/displays?upgraded=1')
  );
}

export function billingCancelUrl(fallbackOrigin?: string): string {
  return process.env.BILLING_CANCEL_URL ?? (fallbackOrigin ? `${fallbackOrigin}/displays` : '/displays');
}
