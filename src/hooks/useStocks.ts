import { useState, useEffect, useCallback } from 'react';
import { fetchStockQuoteCached, type StockQuote } from '../services/stocks';
import { getNextPollDelay } from './polling';

interface UseStocksOptions {
  symbols: string[];
  apiKey: string;
  refreshInterval?: number;
}

interface UseStocksResult {
  quotes: Map<string, StockQuote>;
  isLoading: boolean;
  errors: Map<string, string>;
  lastUpdated: number | null;
  refresh: () => void;
}

export function useStocks({
  symbols,
  apiKey,
  refreshInterval = 60 * 1000, // 1 minute
}: UseStocksOptions): UseStocksResult {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const fetchData = useCallback(async () => {
    if (!apiKey || symbols.length === 0) {
      setQuotes(new Map());
      setErrors(new Map());
      setLastUpdated(null);
      setConsecutiveFailures(0);
      return;
    }

    setIsLoading(true);
    const selectedSymbols = new Set(symbols.map((symbol) => symbol.toUpperCase()));
    const newQuotes = new Map<string, StockQuote>();
    const newErrors = new Map<string, string>();

    for (const symbol of symbols) {
      try {
        const quote = await fetchStockQuoteCached(symbol, apiKey);
        newQuotes.set(symbol.toUpperCase(), quote);
      } catch (err) {
        newErrors.set(
          symbol.toUpperCase(),
          err instanceof Error ? err.message : 'Failed to fetch'
        );
      }
    }

    setQuotes((prev) => {
      const next = new Map<string, StockQuote>();
      for (const symbol of selectedSymbols) {
        const existing = prev.get(symbol);
        if (existing) next.set(symbol, existing);
      }
      for (const [symbol, quote] of newQuotes.entries()) {
        next.set(symbol, quote);
      }
      return next;
    });
    setErrors(newErrors);
    if (newQuotes.size > 0) {
      setLastUpdated(Date.now());
      setConsecutiveFailures(0);
    } else {
      setConsecutiveFailures((prev) => prev + 1);
    }
    setIsLoading(false);
  }, [symbols, apiKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!apiKey || symbols.length === 0) return;

    const interval = setTimeout(fetchData, getNextPollDelay(refreshInterval, consecutiveFailures));
    return () => clearTimeout(interval);
  }, [fetchData, refreshInterval, apiKey, symbols.length, consecutiveFailures]);

  return {
    quotes,
    isLoading,
    errors,
    lastUpdated,
    refresh: fetchData,
  };
}

