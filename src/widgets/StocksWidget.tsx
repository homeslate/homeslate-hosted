import { useState } from 'react';
import {
  Box,
  Text,
  Stack,
  Loader,
  Button,
  Paper,
  TextInput,
  MultiSelect,
  PasswordInput,
  Anchor,
  Group,
} from '@mantine/core';
import {
  IconChartLine,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconExternalLink,
} from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useStocks } from '../hooks/useStocks';
import { popularStocks, popularIndices, type StockQuote } from '../services/stocks';
import classes from './StocksWidget.module.css';

export interface StocksConfig extends WidgetConfig {
  symbols: string[];
  apiKey: string;
  showChange: boolean;
  showDayRange: boolean;
}

function StockRow({ quote, showChange, showDayRange }: { 
  quote: StockQuote; 
  showChange: boolean;
  showDayRange: boolean;
}) {
  const isPositive = quote.change > 0;
  const isNegative = quote.change < 0;
  
  const TrendIcon = isPositive ? IconTrendingUp : isNegative ? IconTrendingDown : IconMinus;
  const changeClass = isPositive ? classes.positive : isNegative ? classes.negative : classes.neutral;

  return (
    <Paper className={classes.stockRow} p="xs">
      <div className={classes.stockInfo}>
        <Text fw={600} size="sm">{quote.symbol}</Text>
        {quote.name && (
          <Text size="xs" c="dimmed" lineClamp={1}>{quote.name}</Text>
        )}
      </div>
      <div className={classes.stockPrice}>
        <Text fw={600} size="sm">${quote.currentPrice.toFixed(2)}</Text>
        {showChange && (
          <div className={`${classes.change} ${changeClass}`}>
            <TrendIcon size={14} />
            <Text size="xs">
              {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
            </Text>
          </div>
        )}
        {showDayRange && (
          <Text size="xs" c="dimmed">
            L: ${quote.lowPrice.toFixed(2)} · H: ${quote.highPrice.toFixed(2)}
          </Text>
        )}
      </div>
    </Paper>
  );
}

export function StocksWidget({ widget }: WidgetProps<StocksConfig>) {
  const { symbols, apiKey, showChange, showDayRange } = widget.config;

  const { quotes, isLoading, errors, refresh } = useStocks({
    symbols,
    apiKey,
  });

  // No API key configured
  if (!apiKey) {
    return (
      <Box className={classes.container}>
        <div className={classes.empty}>
          <IconChartLine size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>API Key Required</Text>
          <Text size="sm" c="dimmed" ta="center">
            Get a free API key from{' '}
            <Anchor href="https://finnhub.io" target="_blank" rel="noopener">
              finnhub.io
            </Anchor>
          </Text>
        </div>
      </Box>
    );
  }

  // No symbols configured
  if (symbols.length === 0) {
    return (
      <Box className={classes.container}>
        <div className={classes.empty}>
          <IconChartLine size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Stocks Selected</Text>
          <Text size="sm" c="dimmed">
            Add stock symbols in widget settings
          </Text>
        </div>
      </Box>
    );
  }

  // Loading state
  if (isLoading && quotes.size === 0) {
    return (
      <Box className={classes.container}>
        <div className={classes.loading}>
          <Loader size="lg" color="green" />
          <Text size="sm" c="dimmed" mt="sm">Loading stocks...</Text>
        </div>
      </Box>
    );
  }

  return (
    <Box className={classes.container}>
      <div className={classes.header}>
        <Text className={classes.title}>
          <IconChartLine size={18} />
          Stocks
        </Text>
        <Group gap="xs">
          {isLoading && <Loader size="xs" color="green" />}
          <Button
            variant="subtle"
            size="xs"
            p={4}
            onClick={refresh}
            className={classes.refreshBtn}
          >
            <IconRefresh size={14} />
          </Button>
        </Group>
      </div>

      <div className={classes.stocksList}>
        <Stack gap="xs">
          {symbols.map(symbol => {
            const quote = quotes.get(symbol.toUpperCase());
            const error = errors.get(symbol.toUpperCase());

            if (error) {
              return (
                <Paper key={symbol} className={classes.stockRow} p="xs">
                  <Text size="sm" fw={600}>{symbol}</Text>
                  <Text size="xs" c="red">{error}</Text>
                </Paper>
              );
            }

            if (!quote) {
              return (
                <Paper key={symbol} className={classes.stockRow} p="xs">
                  <Text size="sm" fw={600}>{symbol}</Text>
                  <Loader size="xs" />
                </Paper>
              );
            }

            return (
              <StockRow
                key={symbol}
                quote={quote}
                showChange={showChange}
                showDayRange={showDayRange}
              />
            );
          })}
        </Stack>
      </div>

      <Text size="xs" c="dimmed" ta="center" mt="xs" className={classes.attribution}>
        Data from Finnhub
      </Text>
    </Box>
  );
}

export function StocksWidgetSettings({ widget, onConfigChange }: WidgetProps<StocksConfig>) {
  const { symbols, apiKey, showChange, showDayRange } = widget.config;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Combined list: popular + search results
  const allSymbols = [...popularIndices, ...popularStocks];

  // Search for stocks when query changes
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    // First filter popular stocks locally
    const localMatches = allSymbols.filter(
      s => s.symbol.toLowerCase().includes(query.toLowerCase()) ||
           s.name.toLowerCase().includes(query.toLowerCase())
    );

    // If we have an API key, also search Finnhub
    if (apiKey && query.length >= 2) {
      setIsSearching(true);
      try {
        const { searchSymbols } = await import('../services/stocks');
        const results = await searchSymbols(query, apiKey);
        // Combine local and API results, deduping
        const combined = [...localMatches];
        results.forEach(r => {
          if (!combined.some(c => c.symbol === r.symbol)) {
            combined.push(r);
          }
        });
        setSearchResults(combined.slice(0, 15));
      } catch {
        setSearchResults(localMatches);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults(localMatches);
    }
  };

  const addSymbol = (symbol: string) => {
    if (symbols.length >= 10) return;
    if (!symbols.includes(symbol.toUpperCase())) {
      onConfigChange({ symbols: [...symbols, symbol.toUpperCase()] });
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeSymbol = (symbol: string) => {
    onConfigChange({ symbols: symbols.filter(s => s !== symbol) });
  };

  return (
    <Stack gap="md">
      <PasswordInput
        label="Finnhub API Key"
        placeholder="Enter your API key"
        description={
          <>
            Get a free key at{' '}
            <Anchor href="https://finnhub.io" target="_blank" size="xs">
              finnhub.io <IconExternalLink size={10} style={{ display: 'inline' }} />
            </Anchor>
          </>
        }
        value={apiKey}
        onChange={(e) => onConfigChange({ apiKey: e.currentTarget.value })}
      />

      <div>
        <Text size="sm" fw={500} mb={4}>Search Stocks</Text>
        <TextInput
          placeholder="Search by symbol or company name..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.currentTarget.value)}
          rightSection={isSearching ? <Loader size="xs" /> : null}
        />
        {!apiKey && (
          <Text size="xs" c="dimmed" mt={4}>
            Add API key to search all stocks
          </Text>
        )}
        
        {searchResults.length > 0 && (
          <Paper className={classes.searchResults} mt="xs" p="xs">
            <Stack gap={4}>
              {searchResults.map((result) => (
                <Button
                  key={result.symbol}
                  variant="subtle"
                  size="sm"
                  fullWidth
                  justify="flex-start"
                  onClick={() => addSymbol(result.symbol)}
                  disabled={symbols.includes(result.symbol) || symbols.length >= 10}
                  className={classes.searchResult}
                >
                  <Text fw={600} size="sm" mr="xs">{result.symbol}</Text>
                  <Text size="xs" c="dimmed" style={{ flex: 1 }} lineClamp={1}>
                    {result.name}
                  </Text>
                  {symbols.includes(result.symbol) && (
                    <Text size="xs" c="green">Added</Text>
                  )}
                </Button>
              ))}
            </Stack>
          </Paper>
        )}
      </div>

      {symbols.length > 0 && (
        <div>
          <Text size="sm" fw={500} mb={4}>
            Selected Stocks ({symbols.length}/10)
          </Text>
          <Group gap="xs">
            {symbols.map(symbol => {
              const info = allSymbols.find(s => s.symbol === symbol);
              return (
                <Button
                  key={symbol}
                  variant="light"
                  size="xs"
                  rightSection={<Text size="xs" ml={4}>×</Text>}
                  onClick={() => removeSymbol(symbol)}
                  title={info?.name}
                >
                  {symbol}
                </Button>
              );
            })}
          </Group>
        </div>
      )}

      <div>
        <label className={classes.checkboxLabel}>
          <input
            type="checkbox"
            checked={showChange}
            onChange={(e) => onConfigChange({ showChange: e.target.checked })}
          />
          <Text size="sm">Show price change</Text>
        </label>
      </div>

      <div>
        <label className={classes.checkboxLabel}>
          <input
            type="checkbox"
            checked={showDayRange}
            onChange={(e) => onConfigChange({ showDayRange: e.target.checked })}
          />
          <Text size="sm">Show day high/low</Text>
        </label>
      </div>
    </Stack>
  );
}

