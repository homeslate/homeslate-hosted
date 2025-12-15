import { useState, useEffect, useCallback } from 'react';
import { fetchStockQuoteCached, type StockQuote } from '../services/stocks';

interface UseStocksOptions {
  symbols: string[];
  apiKey: string;
  refreshInterval?: number;
}

interface UseStocksResult {
  quotes: Map<string, StockQuote>;
  isLoading: boolean;
  errors: Map<string, string>;
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

  const fetchData = useCallback(async () => {
    if (!apiKey || symbols.length === 0) {
      setQuotes(new Map());
      setErrors(new Map());
      return;
    }

    setIsLoading(true);
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

    setQuotes(newQuotes);
    setErrors(newErrors);
    setIsLoading(false);
  }, [symbols, apiKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!apiKey || symbols.length === 0) return;
    
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, apiKey, symbols.length]);

  return {
    quotes,
    isLoading,
    errors,
    refresh: fetchData,
  };
}

