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
} from '@mantine/core';
import { IconCheck, IconPalette } from '@tabler/icons-react';
import { PRESET_THEMES, FONT_OPTIONS } from '../themes/presets';
import { defaultTheme } from '../themes';
import type { DisplayTheme } from '../types/theme';
import classes from './ThemePicker.module.css';

interface ThemePickerProps {
  value: DisplayTheme | undefined;
  onChange: (theme: DisplayTheme) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const current = value ?? defaultTheme;
  const [customizing, setCustomizing] = useState(false);

  const isPreset = PRESET_THEMES.some((p) => p.id === current.id);

  const selectPreset = (preset: DisplayTheme) => {
    onChange(preset);
    setCustomizing(false);
  };

  const updateField = <K extends keyof DisplayTheme>(key: K, val: DisplayTheme[K]) => {
    onChange({ ...current, id: 'custom', name: 'Custom', [key]: val });
  };

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
          item: { background: 'var(--mantine-color-dark-7)', border: '1px solid var(--mantine-color-dark-5)' },
          label: { padding: '0.5rem 0' },
        }}
      >
        <Accordion.Item value="custom">
          <Accordion.Control icon={<IconPalette size={16} />}>
            <Text size="sm" fw={500}>Customize</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <ColorInput
                label="Background"
                description="CSS background value - can be a gradient or solid color"
                value={current.background}
                onChange={(v) => updateField('background', v)}
                size="sm"
                placeholder="Enter CSS background value"
              />

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

              <Group grow>
                <ColorInput
                  label="Primary text"
                  value={current.textPrimary}
                  onChange={(v) => updateField('textPrimary', v)}
                  format="hex"
                  size="sm"
                  swatches={PRESET_THEMES.map((p) => p.textPrimary)}
                />
                <ColorInput
                  label="Muted text"
                  value={current.textMuted}
                  onChange={(v) => updateField('textMuted', v)}
                  format="hex"
                  size="sm"
                  swatches={PRESET_THEMES.map((p) => p.textMuted)}
                />
              </Group>

              <Group grow>
                <ColorInput
                  label="Widget background"
                  value={current.surfaceBg}
                  onChange={(v) => updateField('surfaceBg', v)}
                  format="rgba"
                  size="sm"
                />
                <ColorInput
                  label="Widget border"
                  value={current.surfaceBorder}
                  onChange={(v) => updateField('surfaceBorder', v)}
                  format="rgba"
                  size="sm"
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

              {current.glowEnabled && (
                <ColorInput
                  label="Glow color"
                  value={current.glowColor}
                  onChange={(v) => updateField('glowColor', v)}
                  format="rgba"
                  size="sm"
                />
              )}

              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" fw={500}>Dark mode</Text>
                  <Text size="xs" c="dimmed">Use dark color scheme for UI elements</Text>
                </Stack>
                <Switch
                  checked={current.isDark}
                  onChange={(e) => updateField('isDark', e.currentTarget.checked)}
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
