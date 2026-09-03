import { useState, useCallback } from 'react';
import { apiClient, ApiError } from '../services/apiClient';

type CheckoutResponse = { url: string };

function billingErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useBillingActions(accessToken: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(
    async (priceId: string) => {
      if (!accessToken) throw new Error('Not signed in');
      setLoading(true);
      setError(null);
      try {
        const { url } = await apiClient.post<CheckoutResponse, { priceId: string }>(
          '/api/billing/checkout',
          { token: accessToken, body: { priceId } }
        );
        window.location.href = url;
      } catch (err) {
        setError(billingErrorMessage(err, 'Checkout failed. Try again.'));
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const openPortal = useCallback(async () => {
    if (!accessToken) throw new Error('Not signed in');
    setLoading(true);
    setError(null);
    try {
      const { url } = await apiClient.post<CheckoutResponse>('/api/billing/portal', {
        token: accessToken,
      });
      window.location.href = url;
    } catch (err) {
      setError(billingErrorMessage(err, 'Could not open billing portal. Try again.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  return { startCheckout, openPortal, loading, error };
}

export function getCheckoutPriceIds(): { monthly: string | null; annual: string | null } {
  return {
    monthly: import.meta.env.VITE_STRIPE_PRICE_MONTHLY ?? null,
    annual: import.meta.env.VITE_STRIPE_PRICE_ANNUAL ?? null,
  };
}

export const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === 'true';
