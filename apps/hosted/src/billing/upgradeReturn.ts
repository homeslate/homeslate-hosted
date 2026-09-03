export function isUpgradeReturn(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(query).get('upgraded') === '1';
}

export function shouldContinueUpgradePoll(
  plan: string | null | undefined,
  attempts: number,
  maxAttempts: number
): boolean {
  return plan !== 'pro' && attempts < maxAttempts;
}
