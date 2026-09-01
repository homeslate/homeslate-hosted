import { useMemo } from 'react';
import {
  Box,
  Text,
  Stack,
  Loader,
  Button,
  Paper,
  MultiSelect,
  NumberInput,
  Anchor,
} from '@mantine/core';
import { IconNews, IconRefresh, IconExternalLink } from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types';
import { useNews } from '../hooks/useNews';
import { WidgetDataStatus } from '../chrome/WidgetDataStatus';
import { popularFeeds, type RSSFeed } from '../services/news';
import classes from './NewsWidget.module.css';

export interface NewsConfig extends WidgetConfig {
  feedUrls: string[];
  maxItems: number;
  showSource: boolean;
  showDescription: boolean;
  transparentBackground: boolean;
}

export function NewsWidget({ widget }: WidgetProps<NewsConfig>) {
  const { feedUrls, maxItems, showSource, showDescription, transparentBackground } = widget.config;

  const feeds: RSSFeed[] = useMemo(() => {
    return feedUrls
      .map(url => popularFeeds.find(f => f.url === url))
      .filter((f): f is RSSFeed => f !== undefined);
  }, [feedUrls]);

  const { items, isLoading, error, refresh, lastUpdated } = useNews({
    feeds,
    maxItems,
  });

  // No feeds configured
  if (feedUrls.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconNews size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No News Feeds</Text>
          <Text size="sm" c="dimmed">
            Select news sources in widget settings
          </Text>
        </div>
      </Box>
    );
  }

  // Loading state
  if (isLoading && items.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.loading}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed" mt="sm">Loading news...</Text>
        </div>
      </Box>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.error}>
          <Text size="sm" c="red">{error}</Text>
          <Button
            variant="light"
            color="blue"
            size="xs"
            mt="sm"
            leftSection={<IconRefresh size={14} />}
            onClick={refresh}
          >
            Retry
          </Button>
        </div>
      </Box>
    );
  }

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      <div className={classes.header}>
        <Text className={classes.title}>
          <IconNews size={18} />
          News
        </Text>
        {isLoading && <Loader size="xs" color="blue" />}
      </div>
      <WidgetDataStatus
        widgetId={widget.id}
        lastUpdated={lastUpdated}
        error={error}
        isLoading={isLoading}
      />

      <div className={classes.newsList}>
        <Stack gap="xs">
          {items.map((item, index) => (
            <Paper key={index} className={classes.newsItem} p="xs">
              <Anchor
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.newsLink}
              >
                <Text size="sm" fw={500} className={classes.newsTitle} lineClamp={2}>
                  {item.title}
                </Text>
                <IconExternalLink size={12} className={classes.externalIcon} />
              </Anchor>
              {showDescription && item.description && (
                <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                  {item.description}
                </Text>
              )}
              <div className={classes.newsMeta}>
                {showSource && (
                  <Text size="xs" className={classes.source}>
                    {item.source}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {formatTime(item.pubDate)}
                </Text>
              </div>
            </Paper>
          ))}
        </Stack>
      </div>
    </Box>
  );
}

export function NewsWidgetSettings({ widget, onConfigChange }: WidgetProps<NewsConfig>) {
  const { feedUrls, maxItems, showSource, showDescription } = widget.config;

  const feedOptions = popularFeeds.map(feed => ({
    value: feed.url,
    label: feed.name,
  }));

  return (
    <Stack gap="md">
      <MultiSelect
        label="News Sources"
        placeholder="Select news feeds..."
        data={feedOptions}
        value={feedUrls}
        onChange={(value) => onConfigChange({ feedUrls: value })}
        searchable
        maxValues={5}
        description="Select up to 5 news sources"
      />

      <NumberInput
        label="Maximum Articles"
        min={3}
        max={20}
        value={maxItems}
        onChange={(value) => onConfigChange({ maxItems: Number(value) || 10 })}
      />

      <div>
        <label className={classes.checkboxLabel}>
          <input
            type="checkbox"
            checked={showSource}
            onChange={(e) => onConfigChange({ showSource: e.target.checked })}
          />
          <Text size="sm">Show source name</Text>
        </label>
      </div>

      <div>
        <label className={classes.checkboxLabel}>
          <input
            type="checkbox"
            checked={showDescription}
            onChange={(e) => onConfigChange({ showDescription: e.target.checked })}
          />
          <Text size="sm">Show article description</Text>
        </label>
      </div>
    </Stack>
  );
}

