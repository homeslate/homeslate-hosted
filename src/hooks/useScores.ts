import { useState, useEffect, useCallback } from 'react';
import { fetchScoreboard, type SportGame, type SportsTeam } from '../services/sports';

interface UseScoresOptions {
  leagueId: string;
  /** If non-empty, only games involving one of these team IDs are returned */
  favoriteTeamIds?: string[];
  refreshInterval?: number;
}

interface UseScoresResult {
  games: SportGame[];
  allTeams: SportsTeam[];
  leagueLogo?: string;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Stable string key for array comparison - avoids ref changes triggering re-fetches */
function teamIdsKey(ids: string[]): string {
  return ids.length === 0 ? '' : ids.slice().sort().join(',');
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
  const [error, setError] = useState<string | null>(null);

  const teamIdsStable = teamIdsKey(favoriteTeamIds);

  const fetchData = useCallback(async () => {
    if (!leagueId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { games: fetchedGames, teams, leagueLogo: logo } = await fetchScoreboard(leagueId);
      setLeagueLogo(logo);

      // Filter by favorite teams if specified
      const filtered =
        favoriteTeamIds.length > 0
          ? fetchedGames.filter((g) =>
              g.competitors.some((c) => favoriteTeamIds.includes(c.team.id))
            )
          : fetchedGames;

      // Sort: in-progress first, then pre-game by date, then final
      const sorted = [...filtered].sort((a, b) => {
        const order = { in: 0, pre: 1, post: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setGames(sorted);
      setAllTeams(teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scores');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, teamIdsStable]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!leagueId) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, leagueId]);

  return { games, allTeams, leagueLogo, isLoading, error, refresh: fetchData };
}
