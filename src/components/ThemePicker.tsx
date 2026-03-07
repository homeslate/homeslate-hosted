import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  UnstyledButton,
  ColorInput,
  Select,
  Switch,
  Accordion,
  SimpleGrid,
  Tooltip,
  SegmentedControl,
  Divider,
} from '@mantine/core';
import { IconCheck, IconPalette } from '@tabler/icons-react';
import { PRESET_THEMES, FONT_OPTIONS } from '../themes/presets';
import { defaultTheme } from '../themes';
import type { DisplayTheme, ThemeModeColors } from '../types/theme';
import classes from './ThemePicker.module.css';

interface ThemePickerProps {
  value: DisplayTheme | undefined;
  onChange: (theme: DisplayTheme) => void;
}

/** Derive a ThemeModeColors snapshot from the top-level theme fields (used as fallback) */
function modeColorsFromTheme(theme: DisplayTheme): ThemeModeColors {
  return {
    background: theme.background,
    surfaceBg: theme.surfaceBg,
    surfaceBorder: theme.surfaceBorder,
    textPrimary: theme.textPrimary,
    textMuted: theme.textMuted,
    glowColor: theme.glowColor,
  };
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const current = value ?? defaultTheme;
  const [customizing, setCustomizing] = useState(false);
  const [editingMode, setEditingMode] = useState<'dark' | 'light'>('dark');

  const isPreset = PRESET_THEMES.some((p) => p.id === current.id);

  const selectPreset = (preset: DisplayTheme) => {
    onChange(preset);
    setCustomizing(false);
  };

  /** Update a top-level (mode-agnostic) field */
  const updateField = <K extends keyof DisplayTheme>(key: K, val: DisplayTheme[K]) => {
    onChange({ ...current, id: 'custom', name: 'Custom', [key]: val });
  };

  /** Update a color field in the currently-edited mode's color block */
  const updateModeColor = (key: keyof ThemeModeColors, val: string) => {
    const themeWithId = { ...current, id: 'custom', name: 'Custom' };
    if (editingMode === 'dark') {
      const existing = current.darkColors ?? modeColorsFromTheme(current);
      onChange({ ...themeWithId, darkColors: { ...existing, [key]: val } });
    } else {
      const existing = current.lightColors ?? modeColorsFromTheme(current);
      onChange({ ...themeWithId, lightColors: { ...existing, [key]: val } });
    }
  };

  /** Get the colors currently being edited for the selected mode */
  const modeColors: ThemeModeColors =
    editingMode === 'dark'
      ? (current.darkColors ?? modeColorsFromTheme(current))
      : (current.lightColors ?? modeColorsFromTheme(current));

  return (
    <Stack gap="md">
      {/* Preset grid */}
      <SimpleGrid cols={4} spacing="sm">
        {PRESET_THEMES.map((preset) => (
          <Tooltip key={preset.id} label={preset.name} position="top" withArrow>
            <UnstyledButton
              className={`${classes.presetCard} ${current.id === preset.id && isPreset ? classes.selected : ''}`}
              onClick={() => selectPreset(preset)}
              aria-label={preset.name}
            >
              <div
                className={classes.presetSwatch}
                style={{ background: preset.background }}
              >
                <div
                  className={classes.presetAccent}
                  style={{ background: `linear-gradient(135deg, ${preset.accentPrimary}, ${preset.accentSecondary})` }}
                />
                {current.id === preset.id && isPreset && (
                  <div className={classes.presetCheck}>
                    <IconCheck size={12} stroke={3} />
                  </div>
                )}
              </div>
              <Text size="xs" ta="center" mt={4} c="dimmed" truncate>
                {preset.name}
              </Text>
            </UnstyledButton>
          </Tooltip>
        ))}
      </SimpleGrid>

      {/* Customize accordion */}
      <Accordion
        variant="separated"
        value={customizing ? 'custom' : null}
        onChange={(v) => setCustomizing(v === 'custom')}
        styles={{
          item: { background: 'var(--mantine-color-default)', border: '1px solid var(--mantine-color-default-border)' },
          label: { padding: '0.5rem 0' },
        }}
      >
        <Accordion.Item value="custom">
          <Accordion.Control icon={<IconPalette size={16} />}>
            <Text size="sm" fw={500}>Customize</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              {/* Shared accent colors */}
              <Group grow>
                <ColorInput
                  label="Primary accent"
                  value={current.accentPrimary}
                  onChange={(v) => updateField('accentPrimary', v)}
                  format="hex"
                  size="sm"
                  swatches={PRESET_THEMES.map((p) => p.accentPrimary)}
                />
                <ColorInput
                  label="Secondary accent"
                  value={current.accentSecondary}
                  onChange={(v) => updateField('accentSecondary', v)}
                  format="hex"
                  size="sm"
                  swatches={PRESET_THEMES.map((p) => p.accentSecondary)}
                />
              </Group>

              <Select
                label="Font family"
                data={FONT_OPTIONS}
                value={current.fontFamily}
                onChange={(v) => v && updateField('fontFamily', v)}
                size="sm"
                renderOption={({ option }) => (
                  <Text size="sm" style={{ fontFamily: option.value }}>
                    {option.label}
                  </Text>
                )}
              />

              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" fw={500}>Glow effects</Text>
                  <Text size="xs" c="dimmed">Soft glow on widget hover</Text>
                </Stack>
                <Switch
                  checked={current.glowEnabled}
                  onChange={(e) => updateField('glowEnabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider label="Mode colors" labelPosition="center" />

              {/* Mode selector */}
              <SegmentedControl
                fullWidth
                size="xs"
                value={editingMode}
                onChange={(v) => setEditingMode(v as 'dark' | 'light')}
                data={[
                  { label: 'Dark mode', value: 'dark' },
                  { label: 'Light mode', value: 'light' },
                ]}
              />

              <Text size="xs" c="dimmed">
                These colors apply when the display is in {editingMode} mode.
              </Text>

              <ColorInput
                label="Background"
                description="CSS background value — can be a gradient or solid color"
                value={modeColors.background}
                onChange={(v) => updateModeColor('background', v)}
                size="sm"
                placeholder="Enter CSS background value"
              />

              <Group grow>
                <ColorInput
                  label="Primary text"
                  value={modeColors.textPrimary}
                  onChange={(v) => updateModeColor('textPrimary', v)}
                  format="hex"
                  size="sm"
                  swatches={PRESET_THEMES.map((p) => p.textPrimary)}
                />
                <ColorInput
                  label="Muted text"
                  value={modeColors.textMuted}
                  onChange={(v) => updateModeColor('textMuted', v)}
                  format="hex"
                  size="sm"
                  swatches={PRESET_THEMES.map((p) => p.textMuted)}
                />
              </Group>

              <Group grow>
                <ColorInput
                  label="Widget background"
                  value={modeColors.surfaceBg}
                  onChange={(v) => updateModeColor('surfaceBg', v)}
                  format="rgba"
                  size="sm"
                />
                <ColorInput
                  label="Widget border"
                  value={modeColors.surfaceBorder}
                  onChange={(v) => updateModeColor('surfaceBorder', v)}
                  format="rgba"
                  size="sm"
                />
              </Group>

              {current.glowEnabled && (
                <ColorInput
                  label="Glow color"
                  value={modeColors.glowColor}
                  onChange={(v) => updateModeColor('glowColor', v)}
                  format="rgba"
                  size="sm"
                />
              )}

              <Divider />

              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" fw={500}>Default mode</Text>
                  <Text size="xs" c="dimmed">Which mode this theme starts in</Text>
                </Stack>
                <SegmentedControl
                  size="xs"
                  value={current.isDark ? 'dark' : 'light'}
                  onChange={(v) => updateField('isDark', v === 'dark')}
                  data={[
                    { label: 'Dark', value: 'dark' },
                    { label: 'Light', value: 'light' },
                  ]}
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
