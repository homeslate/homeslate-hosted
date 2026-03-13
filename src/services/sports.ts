// ESPN Sports Scoreboard API Service
// Uses ESPN's publicly accessible (unofficial) API — no key required.
// Endpoint pattern:
//   https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard

export interface League {
  id: string;       // key used in the URL, e.g. "nhl"
  sport: string;    // e.g. "hockey"
  name: string;     // display name
}

export const LEAGUES: League[] = [
  { id: 'nhl',                          sport: 'hockey',     name: 'NHL' },
  { id: 'nfl',                          sport: 'football',   name: 'NFL' },
  { id: 'nba',                          sport: 'basketball', name: 'NBA' },
  { id: 'wnba',                         sport: 'basketball', name: 'WNBA' },
  { id: 'mlb',                          sport: 'baseball',   name: 'MLB' },
  { id: 'mls',                          sport: 'soccer',     name: 'MLS' },
  { id: 'f1',                           sport: 'racing',    name: 'Formula 1' },
  { id: 'mens-college-basketball',      sport: 'basketball', name: 'NCAA Basketball (M)' },
  { id: 'womens-college-basketball',    sport: 'basketball', name: 'NCAA Basketball (W)' },
  { id: 'college-football',             sport: 'football',   name: 'NCAA Football' },
];

export interface SportsTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  logo?: string;
  color?: string;
}

export interface SportsCompetitor {
  team: SportsTeam;
  score: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
  records?: { summary: string }[];
}

export type GameStatus = 'pre' | 'in' | 'post';

export interface RaceSession {
  type: string;       // e.g. "FP1", "Qual", "Race", "Sprint"
  date: string;       // ISO string
  statusDetail: string;
  status: GameStatus;
}

export interface SportGame {
  id: string;
  date: string; // ISO string
  name: string;
  shortName: string;
  status: GameStatus;
  statusDetail: string;   // e.g. "Final", "7:30 PM ET", "3rd 4:22"
  period?: number;        // current period / quarter
  clock?: string;         // remaining clock
  competitors: [SportsCompetitor, SportsCompetitor]; // [away, home] typically
  /** Present for F1/racing: sessions (FP1, Qual, Race, etc.) for this race weekend */
  raceSessions?: RaceSession[];
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

// Simple in-memory cache keyed by leagueId or leagueId:dates
const scoreboardCache = new Map<
  string,
  { data: SportGame[]; timestamp: number; teams: SportsTeam[]; leagueLogo?: string; date?: string }
>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

function buildScoreboardUrl(leagueId: string, sport: string, dates?: string): string {
  const base = `${ESPN_BASE}/${sport}/${leagueId}/scoreboard`;
  return dates ? `${base}?dates=${dates}` : base;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCompetitor(c: any): SportsCompetitor {
  return {
    team: {
      id: c.team?.id ?? '',
      abbreviation: c.team?.abbreviation ?? '',
      displayName: c.team?.displayName ?? c.team?.name ?? '',
      shortDisplayName: c.team?.shortDisplayName ?? c.team?.abbreviation ?? '',
      logo: c.team?.logo,
      color: c.team?.color ? `#${c.team.color}` : undefined,
    },
    score: c.score ?? '0',
    homeAway: c.homeAway === 'home' ? 'home' : 'away',
    winner: c.winner,
    records: c.records,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGame(event: any): SportGame {
  const competition = event.competitions?.[0];
  const statusType = competition?.status?.type;

  let status: GameStatus = 'pre';
  if (statusType?.state === 'in') status = 'in';
  else if (statusType?.state === 'post') status = 'post';

  const competitors: [SportsCompetitor, SportsCompetitor] = [
    parseCompetitor(competition?.competitors?.[0] ?? {}),
    parseCompetitor(competition?.competitors?.[1] ?? {}),
  ];

  return {
    id: event.id,
    date: event.date,
    name: event.name ?? '',
    shortName: event.shortName ?? '',
    status,
    statusDetail: statusType?.shortDetail ?? statusType?.detail ?? '',
    period: competition?.status?.period,
    clock: competition?.status?.displayClock,
    competitors,
  };
}

// F1/racing: each "event" is a race weekend with multiple sessions (FP1, Qual, Race, etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseF1Event(event: any): SportGame {
  const competitions = event.competitions ?? [];
  const raceSession = competitions.find((c: any) => c.type?.abbreviation === 'Race');
  const statusType = raceSession?.status?.type ?? event.status?.type ?? competitions[0]?.status?.type;

  let status: GameStatus = 'pre';
  if (statusType?.state === 'in') status = 'in';
  else if (statusType?.state === 'post') status = 'post';

  const raceSessions: RaceSession[] = competitions.map((c: any) => {
    const st = c.status?.type;
    let s: GameStatus = 'pre';
    if (st?.state === 'in') s = 'in';
    else if (st?.state === 'post') s = 'post';
    return {
      type: c.type?.abbreviation ?? c.type?.name ?? 'Session',
      date: c.date ?? event.date,
      statusDetail: st?.shortDetail ?? st?.detail ?? '',
      status: s,
    };
  });

  const circuitName = event.circuit?.fullName ?? event.circuit?.address?.city ?? '';
  const placeholderTeam: SportsTeam = {
    id: event.id,
    abbreviation: 'GP',
    displayName: event.shortName ?? event.name ?? 'Grand Prix',
    shortDisplayName: event.shortName ?? event.name ?? 'GP',
  };
  const nextSession = raceSessions.find((s) => s.status === 'pre') ?? raceSessions[raceSessions.length - 1];
  const nextDetail = nextSession ? `${nextSession.type}: ${nextSession.statusDetail}` : statusType?.shortDetail ?? '';

  const competitors: [SportsCompetitor, SportsCompetitor] = [
    {
      team: { ...placeholderTeam, displayName: circuitName || placeholderTeam.displayName, shortDisplayName: circuitName || placeholderTeam.shortDisplayName },
      score: '',
      homeAway: 'away',
    },
    {
      team: { ...placeholderTeam, displayName: nextDetail, shortDisplayName: nextDetail },
      score: '',
      homeAway: 'home',
    },
  ];

  return {
    id: event.id,
    date: event.date,
    name: event.name ?? '',
    shortName: event.shortName ?? '',
    status,
    statusDetail: statusType?.shortDetail ?? statusType?.detail ?? '',
    competitors,
    raceSessions,
  };
}

export interface FetchScoreboardOptions {
  /** Date in YYYYMMDD format; if omitted, API returns today's games */
  dates?: string;
}

export interface FetchScoreboardResult {
  games: SportGame[];
  teams: SportsTeam[];
  leagueLogo?: string;
  /** Scoreboard date in YYYYMMDD (from API response when available) */
  date?: string;
}

export async function fetchScoreboard(
  leagueId: string,
  options?: FetchScoreboardOptions
): Promise<FetchScoreboardResult> {
  const league = LEAGUES.find((l) => l.id === leagueId);
  if (!league) throw new Error(`Unknown league: ${leagueId}`);

  const { dates } = options ?? {};
  const cacheKey = dates ? `${leagueId}:${dates}` : leagueId;

  const cached = scoreboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      games: cached.data,
      teams: cached.teams,
      leagueLogo: cached.leagueLogo,
      date: cached.date,
    };
  }

  const url = buildScoreboardUrl(leagueId, league.sport, dates);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ESPN fetch failed: ${response.statusText}`);

  const data = await response.json();

  const isRacing = league.sport === 'racing';
  const games: SportGame[] = (data.events ?? []).map((event: unknown) =>
    isRacing ? parseF1Event(event) : parseGame(event)
  );

  // Extract league logo from response (prefer dark variant for display on dark backgrounds)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logos: any[] = data.leagues?.[0]?.logos ?? [];
  const darkLogo = logos.find((l: any) => l.rel?.includes('dark'))?.href;
  const defaultLogo = logos.find((l: any) => l.rel?.includes('default'))?.href ?? logos[0]?.href;
  const leagueLogo: string | undefined = darkLogo ?? defaultLogo;

  // Scoreboard date from API (e.g. "2026-03-12" -> "20260312")
  const rawDay = data.day?.date;
  const dateStr =
    rawDay && typeof rawDay === 'string'
      ? rawDay.replace(/-/g, '')
      : dates;

  // Collect unique teams from this scoreboard response (racing events use placeholder competitors, so skip)
  const teamMap = new Map<string, SportsTeam>();
  if (!isRacing) {
    for (const game of games) {
      for (const competitor of game.competitors) {
        if (!teamMap.has(competitor.team.id)) {
          teamMap.set(competitor.team.id, competitor.team);
        }
      }
    }
  }
  const teams = Array.from(teamMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  const cacheEntry = {
    data: games,
    timestamp: Date.now(),
    teams,
    leagueLogo,
    date: dateStr,
  };
  scoreboardCache.set(cacheKey, cacheEntry);
  return {
    games,
    teams,
    leagueLogo,
    date: dateStr,
  };
}

// ---------------------------------------------------------------------------
// Fetch all teams for a league (for settings UI)
// ---------------------------------------------------------------------------

const teamsCache = new Map<string, { teams: SportsTeam[]; timestamp: number }>();
const TEAMS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour — teams list rarely changes

export async function fetchLeagueTeams(leagueId: string): Promise<SportsTeam[]> {
  const cached = teamsCache.get(leagueId);
  if (cached && Date.now() - cached.timestamp < TEAMS_CACHE_DURATION) {
    return cached.teams;
  }

  const league = LEAGUES.find((l) => l.id === leagueId);
  if (!league) return [];

  const ESPN_TEAMS_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
  const url = `${ESPN_TEAMS_BASE}/${league.sport}/${leagueId}/teams?limit=200`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    const teams: SportsTeam[] = (data.sports?.[0]?.leagues?.[0]?.teams ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => ({
        id: entry.team?.id ?? '',
        abbreviation: entry.team?.abbreviation ?? '',
        displayName: entry.team?.displayName ?? '',
        shortDisplayName: entry.team?.shortDisplayName ?? entry.team?.abbreviation ?? '',
        logo: entry.team?.logos?.[0]?.href,
        color: entry.team?.color ? `#${entry.team.color}` : undefined,
      })
    ).filter((t: SportsTeam) => t.id);

    teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
    teamsCache.set(leagueId, { teams, timestamp: Date.now() });
    return teams;
  } catch {
    return [];
  }
}

export function invalidateCache(leagueId?: string): void {
  if (leagueId) {
    for (const key of scoreboardCache.keys()) {
      if (key === leagueId || key.startsWith(`${leagueId}:`)) {
        scoreboardCache.delete(key);
      }
    }
  } else {
    scoreboardCache.clear();
  }
}
