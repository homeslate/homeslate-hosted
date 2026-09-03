import { useState, useMemo } from 'react';
import { Modal, TextInput, SimpleGrid, Tooltip, ActionIcon, Text, Group, Button, ScrollArea, UnstyledButton } from '@mantine/core';
import * as TablerIcons from '@tabler/icons-react';

// Curated set of icons relevant for view indicators
const CURATED_ICON_NAMES = [
  // Home & rooms
  'IconHome', 'IconHomeFilled', 'IconBed', 'IconSofa', 'IconToolsKitchen', 'IconToolsKitchen2',
  'IconBath', 'IconGarage', 'IconTree', 'IconPlant', 'IconPlant2',
  // Time & calendar
  'IconClock', 'IconCalendar', 'IconCalendarEvent', 'IconAlarm', 'IconSunrise', 'IconSunset',
  'IconMoon', 'IconSun', 'IconStars',
  // Weather
  'IconCloud', 'IconCloudRain', 'IconSnowflake', 'IconThunderstorm', 'IconWind', 'IconTemperature',
  // Food & kitchen
  'IconCoffee', 'IconPizza', 'IconSalad', 'IconGlass', 'IconBottle', 'IconMeat',
  'IconApple', 'IconChefHat',
  // Entertainment
  'IconDeviceTv', 'IconMusic', 'IconMusicNote', 'IconMovie', 'IconGamepad', 'IconHeadphones',
  // Sports & fitness
  'IconBike', 'IconRun', 'IconSwimming', 'IconBall', 'IconYoga',
  // Work & productivity
  'IconBriefcase', 'IconChecklist', 'IconNote', 'IconNotebook', 'IconClipboard',
  'IconMailbox', 'IconMessages', 'IconPhone',
  // Travel & transport
  'IconCar', 'IconBus', 'IconPlane', 'IconMap', 'IconMapPin',
  // People
  'IconUser', 'IconUsers', 'IconHeart', 'IconBabyCarriage', 'IconDog', 'IconCat',
  // Nature
  'IconFlower', 'IconLeaf', 'IconMountain', 'IconWave',
  // Tech
  'IconDeviceLaptop', 'IconDeviceDesktop', 'IconBrandGoogle', 'IconWifi',
  // Misc
  'IconStar', 'IconBell', 'IconFlag', 'IconPinned', 'IconBookmark', 'IconTag',
  'IconLightbulb', 'IconRecycle', 'IconShoppingCart', 'IconGift',
];

type IconComponent = React.ComponentType<{ size?: number; stroke?: number }>;

function getIconComponent(name: string): IconComponent | null {
  const icon = (TablerIcons as Record<string, unknown>)[name];
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return icon as IconComponent;
  }
  return null;
}

interface IconPickerModalProps {
  opened: boolean;
  onClose: () => void;
  currentIcon?: string;
  onSelect: (iconName: string | undefined) => void;
}

export function IconPickerModal({ opened, onClose, currentIcon, onSelect }: IconPickerModalProps) {
  const [query, setQuery] = useState('');

  const displayedIcons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_ICON_NAMES;

    // Search across all Tabler icon names
    const all = Object.keys(TablerIcons).filter((k) => k.startsWith('Icon'));
    return all.filter((name) => name.toLowerCase().includes(q)).slice(0, 120);
  }, [query]);

  const handleSelect = (name: string) => {
    onSelect(name);
    onClose();
  };

  const handleClear = () => {
    onSelect(undefined);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Choose view icon"
      size="lg"
    >
      <TextInput
        placeholder="Search icons…"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        mb="sm"
        autoFocus
      />
      <ScrollArea h={380} type="scroll">
        <SimpleGrid cols={8} spacing={4}>
          {displayedIcons.map((name) => {
            const Ic = getIconComponent(name);
            if (!Ic) return null;
            const label = name.replace(/^Icon/, '').replace(/([A-Z])/g, ' $1').trim();
            const isActive = name === currentIcon;
            return (
              <Tooltip key={name} label={label} position="top" withArrow openDelay={400}>
                <UnstyledButton
                  onClick={() => handleSelect(name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 6,
                    background: isActive ? 'var(--mantine-color-blue-6)' : 'transparent',
                    color: isActive ? 'white' : 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--mantine-color-default-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <Ic size={22} stroke={1.5} />
                </UnstyledButton>
              </Tooltip>
            );
          })}
          {displayedIcons.length === 0 && (
            <Text c="dimmed" size="sm" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0' }}>
              No icons found for "{query}"
            </Text>
          )}
        </SimpleGrid>
      </ScrollArea>
      <Group justify="space-between" mt="sm">
        <Button variant="subtle" color="gray" size="xs" onClick={handleClear} disabled={!currentIcon}>
          Remove icon
        </Button>
        <ActionIcon variant="subtle" onClick={onClose} aria-label="Cancel">
          <TablerIcons.IconX size={16} />
        </ActionIcon>
      </Group>
    </Modal>
  );
}
