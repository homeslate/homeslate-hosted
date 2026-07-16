import { describe, expect, it } from 'vitest';
import { parseAlarmVoiceCommand } from './parseAlarmVoiceCommand';

describe('parseAlarmVoiceCommand', () => {
  it('parses dismiss phrases', () => {
    expect(parseAlarmVoiceCommand('dismiss')).toEqual({ type: 'dismiss' });
    expect(parseAlarmVoiceCommand('Please DISMISS the alarm')).toEqual({ type: 'dismiss' });
    expect(parseAlarmVoiceCommand('stop')).toEqual({ type: 'dismiss' });
    expect(parseAlarmVoiceCommand('cancel')).toEqual({ type: 'dismiss' });
    expect(parseAlarmVoiceCommand('turn off')).toEqual({ type: 'dismiss' });
  });

  it('parses bare snooze as 5 minutes', () => {
    expect(parseAlarmVoiceCommand('snooze')).toEqual({ type: 'snooze', minutes: 5 });
    expect(parseAlarmVoiceCommand('Snooze please')).toEqual({ type: 'snooze', minutes: 5 });
  });

  it('parses snooze with allowed durations', () => {
    expect(parseAlarmVoiceCommand('snooze 10')).toEqual({ type: 'snooze', minutes: 10 });
    expect(parseAlarmVoiceCommand('snooze for 15 minutes')).toEqual({
      type: 'snooze',
      minutes: 15,
    });
    expect(parseAlarmVoiceCommand('snooze 5 min')).toEqual({ type: 'snooze', minutes: 5 });
  });

  it('ignores snooze with unsupported durations', () => {
    expect(parseAlarmVoiceCommand('snooze 20')).toBeNull();
    expect(parseAlarmVoiceCommand('snooze for 7 minutes')).toBeNull();
  });

  it('returns null for unrelated speech', () => {
    expect(parseAlarmVoiceCommand('what time is it')).toBeNull();
    expect(parseAlarmVoiceCommand('')).toBeNull();
    expect(parseAlarmVoiceCommand('   ')).toBeNull();
  });

  it('picks the earliest match when both appear', () => {
    expect(parseAlarmVoiceCommand('dismiss then snooze')).toEqual({ type: 'dismiss' });
    expect(parseAlarmVoiceCommand('snooze then dismiss')).toEqual({
      type: 'snooze',
      minutes: 5,
    });
  });
});
