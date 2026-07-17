import { describe, expect, it } from 'vitest';
import { getWidgetByType } from './registry';
import { coerceTimerPresets } from './TimersWidget';

describe('Timers widget', () => {
  it('registers default timer settings', () => {
    expect(getWidgetByType('timers')).toMatchObject({
      type: 'timers',
      defaultConfig: {
        presets: [],
        transparentBackground: false,
      },
    });
  });

  it('removes invalid timer presets before rendering', () => {
    expect(
      coerceTimerPresets([
        { id: 'one', label: 'Tea', durationSeconds: 300, toneId: 'chime' },
        { id: '', label: 'Missing ID', durationSeconds: 300, toneId: 'chime' },
        { id: 'bad-duration', label: 'Broken', durationSeconds: 0, toneId: 'chime' },
        { id: 'bad-tone', label: 'Broken', durationSeconds: 300, toneId: 'unknown' },
      ]),
    ).toEqual([{ id: 'one', label: 'Tea', durationSeconds: 300, toneId: 'chime' }]);
  });
});
