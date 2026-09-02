import { SNOOZE_MINUTES, type SnoozeMinutes } from '../alarms/types';

export type AlarmVoiceCommand =
  | { type: 'dismiss' }
  | { type: 'snooze'; minutes: SnoozeMinutes };

const DISMISS_PHRASES = ['turn off', 'dismiss', 'cancel', 'stop'] as const;

function isSnoozeMinutes(n: number): n is SnoozeMinutes {
  return (SNOOZE_MINUTES as readonly number[]).includes(n);
}

/**
 * Parse a speech transcript into an alarm command.
 * First match by index in the transcript wins.
 */
export function parseAlarmVoiceCommand(transcript: string): AlarmVoiceCommand | null {
  const text = transcript.toLowerCase().trim();
  if (!text) return null;

  const candidates: Array<{ index: number; command: AlarmVoiceCommand }> = [];

  const snoozeWithNum = /\bsnooze(?:\s+for)?\s+(\d+)\s*(?:min(?:ute)?s?)?\b/.exec(text);
  if (snoozeWithNum && snoozeWithNum.index !== undefined) {
    const mins = Number(snoozeWithNum[1]);
    if (isSnoozeMinutes(mins)) {
      candidates.push({
        index: snoozeWithNum.index,
        command: { type: 'snooze', minutes: mins },
      });
    }
  } else {
    const snoozeBare = /\bsnooze\b/.exec(text);
    if (snoozeBare && snoozeBare.index !== undefined) {
      candidates.push({
        index: snoozeBare.index,
        command: { type: 'snooze', minutes: 5 },
      });
    }
  }

  for (const phrase of DISMISS_PHRASES) {
    const index = text.indexOf(phrase);
    if (index >= 0) {
      candidates.push({ index, command: { type: 'dismiss' } });
      break;
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.index - b.index);
  return candidates[0].command;
}
