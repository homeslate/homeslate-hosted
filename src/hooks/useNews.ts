import { useState, useEffect, useCallback } from 'react';
import { fetchNewsCached, type NewsItem, type RSSFeed } from '../services/news';
import { getNextPollDelay } from './polling';

interface UseNewsOptions {
  feeds: RSSFeed[];
  maxItems?: number;
  refreshInterval?: number;
}

interface UseNewsResult {
  items: NewsItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

export function useNews({
  feeds,
  maxItems = 10,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
}: UseNewsOptions): UseNewsResult {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const fetchData = useCallback(async () => {
    if (feeds.length === 0) {
      setItems([]);
      setError(null);
      setLastUpdated(null);
      setConsecutiveFailures(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newsItems = await fetchNewsCached(feeds);
      setItems(newsItems.slice(0, maxItems));
      setLastUpdated(Date.now());
      setConsecutiveFailures(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
      setConsecutiveFailures((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [feeds, maxItems]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (feeds.length === 0) return;

    const timeout = setTimeout(
      fetchData,
      getNextPollDelay(refreshInterval, consecutiveFailures)
    );
    return () => clearTimeout(timeout);
  }, [fetchData, refreshInterval, feeds.length, consecutiveFailures]);

  return {
    items,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchData,
  };
}

