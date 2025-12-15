import { useState, useEffect, useCallback } from 'react';
import { fetchNewsCached, type NewsItem, type RSSFeed } from '../services/news';

interface UseNewsOptions {
  feeds: RSSFeed[];
  maxItems?: number;
  refreshInterval?: number;
}

interface UseNewsResult {
  items: NewsItem[];
  isLoading: boolean;
  error: string | null;
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

  const fetchData = useCallback(async () => {
    if (feeds.length === 0) {
      setItems([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newsItems = await fetchNewsCached(feeds);
      setItems(newsItems.slice(0, maxItems));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [feeds, maxItems]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (feeds.length === 0) return;
    
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, feeds.length]);

  return {
    items,
    isLoading,
    error,
    refresh: fetchData,
  };
}

