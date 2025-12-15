// RSS Feed News Service
// Free, no API key required - works with any RSS feed
// Uses a CORS proxy for browser compatibility

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  source: string;
}

export interface RSSFeed {
  name: string;
  url: string;
}

// Popular RSS feeds users can choose from
export const popularFeeds: RSSFeed[] = [
  { name: 'BBC News - Top Stories', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'BBC News - World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'BBC News - Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'Reuters - Top News', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best' },
  { name: 'CNN - Top Stories', url: 'http://rss.cnn.com/rss/edition.rss' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'ESPN - Top Headlines', url: 'https://www.espn.com/espn/rss/news' },
  { name: 'ESPN - NFL', url: 'https://www.espn.com/espn/rss/nfl/news' },
  { name: 'ESPN - NBA', url: 'https://www.espn.com/espn/rss/nba/news' },
  { name: 'ESPN - MLB', url: 'https://www.espn.com/espn/rss/mlb/news' },
];

// CORS proxy for fetching RSS feeds from browser
// For production, you'd want to run your own proxy or backend
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Fetch and parse an RSS feed
 */
export async function fetchRSSFeed(feedUrl: string, feedName: string): Promise<NewsItem[]> {
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(feedUrl)}`;
  
  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.statusText}`);
  }
  
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');
  
  // Check for parse errors
  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    throw new Error('Failed to parse RSS feed');
  }
  
  const items: NewsItem[] = [];
  
  // Handle both RSS 2.0 and Atom formats
  const rssItems = xml.querySelectorAll('item');
  const atomEntries = xml.querySelectorAll('entry');
  
  const entries = rssItems.length > 0 ? rssItems : atomEntries;
  
  entries.forEach((item) => {
    // RSS 2.0 format
    const title = item.querySelector('title')?.textContent?.trim() || '';
    const link = item.querySelector('link')?.textContent?.trim() || 
                 item.querySelector('link')?.getAttribute('href') || '';
    const description = item.querySelector('description')?.textContent?.trim() ||
                       item.querySelector('summary')?.textContent?.trim() ||
                       item.querySelector('content')?.textContent?.trim() || '';
    const pubDateStr = item.querySelector('pubDate')?.textContent ||
                       item.querySelector('published')?.textContent ||
                       item.querySelector('updated')?.textContent || '';
    
    if (title) {
      items.push({
        title,
        link,
        description: stripHtml(description).slice(0, 200),
        pubDate: pubDateStr ? new Date(pubDateStr) : new Date(),
        source: feedName,
      });
    }
  });
  
  return items;
}

/**
 * Fetch multiple RSS feeds and combine results
 */
export async function fetchMultipleFeeds(feeds: RSSFeed[]): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    feeds.map(feed => fetchRSSFeed(feed.url, feed.name))
  );
  
  const allItems: NewsItem[] = [];
  
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  });
  
  // Sort by date, newest first
  return allItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Cache for news data
const newsCache = new Map<string, { data: NewsItem[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchNewsCached(feeds: RSSFeed[]): Promise<NewsItem[]> {
  const cacheKey = feeds.map(f => f.url).sort().join('|');
  const cached = newsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetchMultipleFeeds(feeds);
  newsCache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}

