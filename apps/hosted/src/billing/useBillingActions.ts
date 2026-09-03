import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

type CheckoutResponse = { url: string };

export function useBillingActions(accessToken: string | null) {
  const [loading, setLoading] = useState(false);

  const startCheckout = useCallback(
    async (priceId: string) => {
      if (!accessToken) throw new Error('Not signed in');
      setLoading(true);
      try {
        const { url } = await apiClient.post<CheckoutResponse, { priceId: string }>(
          '/api/billing/checkout',
          { token: accessToken, body: { priceId } }
        );
        window.location.href = url;
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const openPortal = useCallback(async () => {
    if (!accessToken) throw new Error('Not signed in');
    setLoading(true);
    try {
      const { url } = await apiClient.post<CheckoutResponse>('/api/billing/portal', {
        token: accessToken,
      });
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  return { startCheckout, openPortal, loading };
}

export function getCheckoutPriceIds(): { monthly: string | null; annual: string | null } {
  return {
    monthly: import.meta.env.VITE_STRIPE_PRICE_MONTHLY ?? null,
    annual: import.meta.env.VITE_STRIPE_PRICE_ANNUAL ?? null,
  };
}

export const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === 'true';
