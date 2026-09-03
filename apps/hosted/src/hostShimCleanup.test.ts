import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DEAD_SHIMS = [
  'src/components/Dashboard.tsx',
  'src/components/WidgetWrapper.tsx',
  'src/components/WidgetPanel.tsx',
  'src/components/ThemeDocumentManager.tsx',
  'src/components/HolidayEffects.tsx',
  'src/components/BackgroundSlideshow.tsx',
  'src/components/StickyNote.tsx',
  'src/components/viewRotationClock.ts',
  'src/components/index.ts',
  'src/components/AddWidgetPanel.tsx',
  'src/components/AddWidgetPanel.module.css',
  'src/components/WidgetDataStatus.tsx',
  'src/alarms/AlarmRuntime.tsx',
  'src/alarms/alertQueue.ts',
  'src/alarms/alertTypes.ts',
  'src/alarms/tones.ts',
  'src/alarms/AlarmsContext.tsx',
  'src/alarms/AlarmListEditor.tsx',
  'src/alarms/types.ts',
  'src/alarms/schedule.ts',
  'src/holidays/registry.ts',
  'src/themes/index.ts',
  'src/themes/defaults.ts',
  'src/themes/utils.ts',
  'src/themes/mantineBridge.ts',
  'src/themes/themeDocumentValidation.ts',
  'src/types/theme.ts',
  'src/widgets/registry.ts',
  'src/widgets/index.ts',
  'src/widgets/googleCalendarError.ts',
  'src/timers/TimersContext.tsx',
  'src/hooks/useGooglePhotos.ts',
  'src/services/googlePhotos.ts',
];

describe('phase 4 leftover host shims', () => {
  it.each(DEAD_SHIMS)('%s is removed', (file) => {
    expect(existsSync(file)).toBe(false);
  });
});
