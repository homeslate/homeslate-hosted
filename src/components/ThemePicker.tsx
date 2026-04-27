import { Stack, Text, Select, Divider } from '@mantine/core';
import { THEME_PRESET_OPTIONS } from '../themes';
import { useDashboardStore } from '../store/dashboardStore';

interface ThemePickerProps {
  displayId: string;
}

export function ThemePicker({ displayId }: ThemePickerProps) {
  const displays = useDashboardStore((state) => state.displays);
  const setActiveTheme = useDashboardStore((state) => state.setActiveTheme);
  const setColorMode = useDashboardStore((state) => state.setColorMode);

  const display = displays.find((d) => d.id === displayId);
  const activeThemeId = display?.activeThemeId ?? null;
  const colorMode = display?.colorMode ?? 'dark';

  return (
    <Stack gap="md">
      <Select
        label="Theme preset"
        data={THEME_PRESET_OPTIONS}
        value={activeThemeId ?? 'theme_cosmos'}
        onChange={(val) => {
          if (!val || !displayId) return;
          setActiveTheme(displayId, val);
        }}
        size="sm"
      />

      <Select
        label="Default color mode"
        data={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        value={colorMode}
        onChange={(val) => {
          if (val && displayId) {
            setColorMode(displayId, val as 'dark' | 'light');
          }
        }}
        size="sm"
      />

      <Divider />

      <Text size="xs" c="dimmed">
        Advanced theme customization is coming in a future release.
        Currently you can select from 8 bundled presets.
      </Text>
    </Stack>
  );
}