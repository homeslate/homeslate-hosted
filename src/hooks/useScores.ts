import { useState, useEffect, useCallback } from 'react';
import { fetchScoreboard, type SportGame, type SportsTeam } from '../services/sports';

interface UseScoresOptions {
  leagueId: string;
  /** If non-empty, only games involving one of these team IDs are returned */
  favoriteTeamIds?: string[];
  refreshInterval?: number;
}

/** Format date as YYYYMMDD (local date) */
function getTodayYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Previous day in YYYYMMDD */
function getPreviousDay(yyyymmdd: string): string {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const prev = new Date(y, m, d);
  prev.setDate(prev.getDate() - 1);
  const py = prev.getFullYear();
  const pm = String(prev.getMonth() + 1).padStart(2, '0');
  const pd = String(prev.getDate()).padStart(2, '0');
  return `${py}${pm}${pd}`;
}

interface UseScoresResult {
  games: SportGame[];
  allTeams: SportsTeam[];
  leagueLogo?: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => Promise<void>;
}

function filterAndSortGames(
  fetchedGames: SportGame[],
  favoriteTeamIds: string[]
): SportGame[] {
  const isRacing = fetchedGames.some((g) => g.raceSessions?.length);
  const filtered =
    favoriteTeamIds.length > 0 && !isRacing
      ? fetchedGames.filter((g) =>
          g.competitors.some((c) => favoriteTeamIds.includes(c.team.id))
        )
      : fetchedGames;
  return [...filtered].sort((a, b) => {
    const order = { in: 0, pre: 1, post: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(b.date).getTime() - new Date(a.date).getTime(); // newest first
  });
}

export function useScores({
  leagueId,
  favoriteTeamIds = [],
  refreshInterval = 2 * 60 * 1000, // 2 minutes
}: UseScoresOptions): UseScoresResult {
  const [games, setGames] = useState<SportGame[]>([]);
  const [allTeams, setAllTeams] = useState<SportsTeam[]>([]);
  const [leagueLogo, setLeagueLogo] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oldestFetchedDate, setOldestFetchedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!leagueId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchScoreboard(leagueId);
      const { games: fetchedGames, teams, leagueLogo: logo, date: responseDate } = result;
      setLeagueLogo(logo);
      setOldestFetchedDate(responseDate ?? getTodayYYYYMMDD());

      const sorted = filterAndSortGames(fetchedGames, favoriteTeamIds);
      setGames(sorted);
      setAllTeams(teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scores');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, favoriteTeamIds]);

  const loadMore = useCallback(async () => {
    if (!leagueId || isLoadingMore || isLoading) return;
    const baseDate = oldestFetchedDate ?? getTodayYYYYMMDD();
    const previousDay = getPreviousDay(baseDate);

    setIsLoadingMore(true);
    try {
      const result = await fetchScoreboard(leagueId, { dates: previousDay });
      const { games: fetchedGames } = result;
      setOldestFetchedDate(previousDay);

      const sortedNew = filterAndSortGames(fetchedGames, favoriteTeamIds);
      setGames((prev) => {
        const byId = new Map(prev.map((g) => [g.id, g]));
        for (const g of sortedNew) {
          if (!byId.has(g.id)) byId.set(g.id, g);
        }
        const merged = Array.from(byId.values()).sort((a, b) => {
          const order = { in: 0, pre: 1, post: 2 };
          if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        return merged;
      });
    } catch {
      // Silent fail for load-more; user can retry by scrolling again
    } finally {
      setIsLoadingMore(false);
    }
  }, [leagueId, oldestFetchedDate, favoriteTeamIds, isLoadingMore, isLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!leagueId) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, leagueId]);

  return { games, allTeams, leagueLogo, isLoading, isLoadingMore, error, refresh: fetchData, loadMore };
}
