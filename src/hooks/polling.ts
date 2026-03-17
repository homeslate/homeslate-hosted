const RECOVERY_BASE_MS = 5_000;
const RECOVERY_MAX_MS = 60_000;

export function getNextPollDelay(refreshIntervalMs: number, consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return refreshIntervalMs;

  const retryDelay = Math.min(
    RECOVERY_MAX_MS,
    RECOVERY_BASE_MS * (2 ** (consecutiveFailures - 1))
  );

  // Recover faster than normal cadence after failures, but never slower.
  return Math.min(refreshIntervalMs, retryDelay);
}
