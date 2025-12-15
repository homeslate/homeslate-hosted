// Stock Market Service using Finnhub
// Free tier: 60 calls/minute - requires API key
// Get your free API key at: https://finnhub.io/

export interface StockQuote {
  symbol: string;
  name?: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  previousClose: number;
  timestamp: number;
}

export interface StockSymbol {
  symbol: string;
  name: string;
}

// Popular stock symbols for quick selection
export const popularStocks: StockSymbol[] = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'INTC', name: 'Intel Corporation' },
];

// Index/ETF symbols
export const popularIndices: StockSymbol[] = [
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'DIA', name: 'Dow Jones ETF' },
  { symbol: 'IWM', name: 'Russell 2000 ETF' },
  { symbol: 'VTI', name: 'Total Stock Market ETF' },
];

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Fetch a stock quote from Finnhub
 */
export async function fetchStockQuote(
  symbol: string,
  apiKey: string
): Promise<StockQuote> {
  if (!apiKey) {
    throw new Error('API key required. Get a free key at finnhub.io');
  }

  const url = new URL(`${FINNHUB_BASE_URL}/quote`);
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('token', apiKey);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key');
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment.');
    }
    throw new Error(`Failed to fetch quote: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Finnhub returns 0 for all values if symbol not found
  if (data.c === 0 && data.h === 0 && data.l === 0) {
    throw new Error(`Symbol "${symbol}" not found`);
  }

  return {
    symbol: symbol.toUpperCase(),
    currentPrice: data.c,
    change: data.d,
    changePercent: data.dp,
    highPrice: data.h,
    lowPrice: data.l,
    openPrice: data.o,
    previousClose: data.pc,
    timestamp: data.t * 1000,
  };
}

/**
 * Fetch multiple stock quotes
 */
export async function fetchMultipleQuotes(
  symbols: string[],
  apiKey: string
): Promise<Map<string, StockQuote | Error>> {
  const results = new Map<string, StockQuote | Error>();
  
  // Fetch sequentially to respect rate limits
  for (const symbol of symbols) {
    try {
      const quote = await fetchStockQuote(symbol, apiKey);
      // Find the name from our lists
      const stockInfo = [...popularStocks, ...popularIndices].find(
        s => s.symbol === symbol.toUpperCase()
      );
      if (stockInfo) {
        quote.name = stockInfo.name;
      }
      results.set(symbol.toUpperCase(), quote);
    } catch (err) {
      results.set(symbol.toUpperCase(), err instanceof Error ? err : new Error('Unknown error'));
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * Search for stock symbols
 */
export async function searchSymbols(
  query: string,
  apiKey: string
): Promise<StockSymbol[]> {
  if (!apiKey || !query || query.length < 1) {
    return [];
  }

  const url = new URL(`${FINNHUB_BASE_URL}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('token', apiKey);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  
  return (data.result || [])
    .filter((item: { type: string }) => item.type === 'Common Stock')
    .slice(0, 10)
    .map((item: { symbol: string; description: string }) => ({
      symbol: item.symbol,
      name: item.description,
    }));
}

// Cache for stock data
const stockCache = new Map<string, { data: StockQuote; timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 1 minute (stocks change frequently)

export async function fetchStockQuoteCached(
  symbol: string,
  apiKey: string
): Promise<StockQuote> {
  const cacheKey = symbol.toUpperCase();
  const cached = stockCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetchStockQuote(symbol, apiKey);
  stockCache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}

