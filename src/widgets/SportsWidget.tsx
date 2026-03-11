import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Text,
  Stack,
  Loader,
  Group,
  Button,
  Select,
  Badge,
  ScrollArea,
  MultiSelect,
  Divider,
  Switch,
} from '@mantine/core';
import {
  IconTrophy,
  IconRefresh,
} from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useScores } from '../hooks/useScores';
import { LEAGUES, fetchLeagueTeams, type SportsTeam } from '../services/sports';
import type { SportGame } from '../services/sports';
import classes from './SportsWidget.module.css';

export interface SportsConfig extends WidgetConfig {
  leagueId: string;
  favoriteTeamIds: string[];
  showAllGames: boolean;
  showCurrentGames: boolean;
  transparentBackground: boolean;
}

// ---------------------------------------------------------------------------
// Game card
// ---------------------------------------------------------------------------

function GameCard({ game }: { game: SportGame }) {
  const away = game.competitors.find((c) => c.homeAway === 'away') ?? game.competitors[0];
  const home = game.competitors.find((c) => c.homeAway === 'home') ?? game.competitors[1];

  const isLive = game.status === 'in';
  const isFinal = game.status === 'post';
  const isPre = game.status === 'pre';

  const statusColor = isLive ? 'green' : isFinal ? 'dimmed' : 'blue';

  const awayWon = isFinal && away.winner;
  const homeWon = isFinal && home.winner;

  return (
    <Box className={classes.gameCard}>
      {/* Status row */}
      <Group justify="center" mb={4}>
        {isLive ? (
          <Badge color="green" size="xs" variant="dot" className={classes.liveBadge}>
            {game.clock && game.period
              ? `${formatPeriod(game.period, game.statusDetail)} · ${game.clock}`
              : game.statusDetail}
          </Badge>
        ) : (
          <Text size="xs" c={statusColor} className={isFinal ? classes.finalText : ''}>
            {game.statusDetail}
          </Text>
        )}
      </Group>

      {/* Teams & scores */}
      <Stack gap={2}>
        <TeamRow
          team={away.team}
          score={away.score}
          isWinner={awayWon}
          showScore={!isPre}
        />
        <TeamRow
          team={home.team}
          score={home.score}
          isWinner={homeWon}
          showScore={!isPre}
        />
      </Stack>
    </Box>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  showScore,
}: {
  team: SportsTeam;
  score: string;
  isWinner?: boolean;
  showScore: boolean;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" className={classes.teamRow}>
      <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
        {team.logo && (
          <img
            src={team.logo}
            alt={team.abbreviation}
            className={classes.teamLogo}
          />
        )}
        <Text
          size="sm"
          fw={isWinner ? 700 : 400}
          className={classes.teamName}
          truncate
        >
          {team.shortDisplayName || team.abbreviation}
        </Text>
      </Group>
      {showScore && (
        <Text size="sm" fw={isWinner ? 700 : 500} className={classes.score}>
          {score}
        </Text>
      )}
    </Group>
  );
}

function formatPeriod(period: number, detail: string): string {
  // Extract period label from status detail if possible (e.g. "3rd 4:22")
  const match = detail.match(/^(\d+(?:st|nd|rd|th)|OT|Final|Halftime)/i);
  if (match) return match[1];
  return `P${period}`;
}

// ---------------------------------------------------------------------------
// Widget display
// ---------------------------------------------------------------------------

export function SportsWidget({ widget }: WidgetProps<SportsConfig>) {
  const { leagueId, favoriteTeamIds, showAllGames, showCurrentGames = true, transparentBackground } = widget.config;

  const teamFilter = useMemo(
    () => (showAllGames ? [] : favoriteTeamIds),
    [showAllGames, favoriteTeamIds]
  );

  const { games: rawGames, leagueLogo, isLoading, error, refresh } = useScores({
    leagueId,
    favoriteTeamIds: teamFilter,
  });

  const leagueName = LEAGUES.find((l) => l.id === leagueId)?.name ?? leagueId.toUpperCase();

  const games = useMemo(
    () =>
      showCurrentGames ? rawGames : rawGames.filter((g) => g.status !== 'in'),
    [rawGames, showCurrentGames]
  );

  if (!leagueId) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconTrophy size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No League Selected</Text>
          <Text size="sm" c="dimmed" ta="center">
            Choose a league in widget settings
          </Text>
        </div>
      </Box>
    );
  }

  if (isLoading && games.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.loading}>
          <Loader size="lg" color="green" />
          <Text size="sm" c="dimmed" mt="sm">Loading scores...</Text>
        </div>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconTrophy size={48} className={classes.emptyIcon} />
          <Text size="sm" c="red" ta="center">{error}</Text>
          <Button size="xs" variant="subtle" onClick={refresh} mt="sm">
            Retry
          </Button>
        </div>
      </Box>
    );
  }

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      {/* Header */}
      <div className={classes.header}>
        <Text className={classes.title}>
          {leagueLogo ? (
            <img
              src={leagueLogo}
              alt={leagueName}
              className={classes.leagueLogo}
            />
          ) : (
            <IconTrophy size={16} />
          )}
          {leagueName}
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

      {games.length === 0 ? (
        <div className={classes.empty}>
          <Text size="sm" c="dimmed" ta="center">
            No games scheduled today
          </Text>
          {!showAllGames && favoriteTeamIds.length > 0 && (
            <Text size="xs" c="dimmed" ta="center" mt={4}>
              (filtered to favorite teams)
            </Text>
          )}
        </div>
      ) : (
        <ScrollArea className={classes.gamesList} scrollbarSize={4}>
          <Stack gap="xs">
            {games.map((game, i) => (
              <div key={game.id}>
                {i > 0 && <Divider opacity={0.3} />}
                <GameCard game={game} />
              </div>
            ))}
          </Stack>
        </ScrollArea>
      )}

      <Text size="xs" c="dimmed" ta="center" mt="xs" className={classes.attribution}>
        Data from ESPN
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

export function SportsWidgetSettings({ widget, onConfigChange }: WidgetProps<SportsConfig>) {
  const { leagueId, favoriteTeamIds, showAllGames, showCurrentGames } = widget.config;

  const [availableTeams, setAvailableTeams] = useState<SportsTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Load teams whenever league changes
  useEffect(() => {
    if (!leagueId) {
      setAvailableTeams([]);
      return;
    }
    setLoadingTeams(true);
    fetchLeagueTeams(leagueId)
      .then(setAvailableTeams)
      .finally(() => setLoadingTeams(false));
  }, [leagueId]);

  const leagueOptions = LEAGUES.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const teamOptions = availableTeams.map((t) => ({
    value: t.id,
    label: t.displayName,
  }));

  const handleLeagueChange = (value: string | null) => {
    onConfigChange({ leagueId: value ?? '', favoriteTeamIds: [] });
  };

  const handleTeamsChange = (values: string[]) => {
    onConfigChange({ favoriteTeamIds: values });
  };

  return (
    <Stack gap="md">
      <Select
        label="League"
        placeholder="Select a league"
        data={leagueOptions}
        value={leagueId || null}
        onChange={handleLeagueChange}
        searchable
      />

      {leagueId && (
        <MultiSelect
          label="Favorite Teams"
          description="Only games featuring these teams will be shown (unless 'Show all games' is on)"
          placeholder={loadingTeams ? 'Loading teams...' : 'Search for teams…'}
          data={teamOptions}
          value={favoriteTeamIds}
          onChange={handleTeamsChange}
          searchable
          clearable
          disabled={loadingTeams}
          rightSection={loadingTeams ? <Loader size="xs" /> : undefined}
          maxDropdownHeight={200}
          limit={50}
        />
      )}

      <Switch
        label="Show all games"
        description="Show every game instead of just your favorite teams"
        checked={showAllGames}
        onChange={(e) => onConfigChange({ showAllGames: e.currentTarget.checked })}
      />

      <Switch
        label="Show current games"
        description="Include games that are currently in progress"
        checked={showCurrentGames ?? true}
        onChange={(e) => onConfigChange({ showCurrentGames: e.currentTarget.checked })}
      />
    </Stack>
  );
}
