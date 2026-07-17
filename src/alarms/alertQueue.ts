import type { AlertQueueItem } from './alertTypes';

export function dedupeEnqueue(
  queue: AlertQueueItem[],
  items: AlertQueueItem[],
): AlertQueueItem[] {
  const ids = new Set(queue.map((item) => item.id));
  const next = [...queue];

  for (const item of items) {
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    next.push(item);
  }

  return next;
}
