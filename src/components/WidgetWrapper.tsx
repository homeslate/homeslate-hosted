import { useEffect, useState, Suspense } from 'react';
import { Paper, ActionIcon, Group, Text, Modal, Stack, Button, Tooltip, Switch, Divider, Center, Loader } from '@mantine/core';
import { IconSettings, IconTrash, IconGripVertical, IconArrowsMaximize, IconCircleFilled } from '@tabler/icons-react';
import type { WidgetDefinition, WidgetConfig } from '../types/widget';
import { getWidgetByType, type WidgetHealthStatus } from '@homeslate/widgets';
import { useDashboardStore } from '../store/dashboardStore';
import classes from './WidgetWrapper.module.css';

function WidgetLoader() {
  return (
    <Center style={{ width: '100%', height: '100%' }}>
      <Loader size="sm" />
    </Center>
  );
}

interface WidgetWrapperProps {
  widget: WidgetDefinition;
  isEditing: boolean;
  onConfigChangeOverride?: (widgetId: string, config: Partial<WidgetConfig>) => void;
}

export function WidgetWrapper({ widget, isEditing, onConfigChangeOverride }: WidgetWrapperProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<WidgetHealthStatus>('idle');
  const { updateWidgetConfig, removeWidget } = useDashboardStore();

  useEffect(() => {
    const onHealthChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ widgetId: string; status: WidgetHealthStatus }>;
      if (customEvent.detail?.widgetId === widget.id) {
        setHealthStatus(customEvent.detail.status);
      }
    };

    window.addEventListener('widget-health-change', onHealthChange);
    return () => window.removeEventListener('widget-health-change', onHealthChange);
  }, [widget.id]);

  const widgetEntry = getWidgetByType(widget.type);

  if (!widgetEntry) {
    return (
      <Paper className={classes.wrapper} p="md">
        <Text c="red">Unknown widget type: {widget.type}</Text>
      </Paper>
    );
  }

  const WidgetComponent = widgetEntry.component;
  const SettingsComponent = widgetEntry.settingsComponent;
  const isTransparent = widget.config.transparentBackground === true;

  const handleConfigChange = (config: Partial<WidgetConfig>) => {
    if (onConfigChangeOverride) {
      onConfigChangeOverride(widget.id, config);
    } else {
      updateWidgetConfig(widget.id, config);
    }
  };

  const healthLabel: Record<WidgetHealthStatus, string> = {
    idle: 'No recent data yet',
    loading: 'Loading data',
    ok: 'Healthy',
    stale: 'Using cached data',
    error: 'Fetch error',
  };

  const healthClass: Record<WidgetHealthStatus, string> = {
    idle: classes.healthIdle,
    loading: classes.healthLoading,
    ok: classes.healthOk,
    stale: classes.healthStale,
    error: classes.healthError,
  };

  return (
    <>
      <Paper
        className={`${classes.wrapper} ${isTransparent ? classes.transparent : ''} ${isEditing ? classes.editing : ''}`}
        data-widget-id={widget.id}
      >
        {isEditing && (
          <>
            <div className={classes.toolbar}>
              <Group gap="xs" wrap="nowrap" className={classes.toolbarLeft}>
                <div className={`${classes.dragHandle} widget-drag-handle`}>
                  <IconGripVertical size={16} />
                </div>
                <Text size="xs" c="dimmed" className={classes.widgetName}>
                  {widgetEntry.name}
                </Text>
              </Group>
              <Group gap="xs" wrap="nowrap" className={classes.toolbarRight}>
                <Tooltip label="Drag edges to resize" position="bottom">
                  <div className={classes.sizeIndicator}>
                    <IconArrowsMaximize size={12} />
                    <Text size="xs">{widget.layout.w}×{widget.layout.h}</Text>
                  </div>
                </Tooltip>
                <Tooltip label={`Data status: ${healthLabel[healthStatus]}`} position="bottom">
                  <div className={`${classes.healthIndicator} ${healthClass[healthStatus]}`}>
                    <IconCircleFilled size={8} />
                  </div>
                </Tooltip>
                {SettingsComponent && (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => setSettingsOpen(true)}
                    className={classes.toolbarButton}
                  >
                    <IconSettings size={16} />
                  </ActionIcon>
                )}
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => removeWidget(widget.id)}
                  className={classes.toolbarButton}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </div>
            <div className={classes.resizeHint}>
              Drag edges to resize
            </div>
          </>
        )}
        <div className={classes.content}>
          <Suspense fallback={<WidgetLoader />}>
            <WidgetComponent
              widget={widget}
              isEditing={isEditing}
              onConfigChange={handleConfigChange}
            />
          </Suspense>
        </div>
      </Paper>

      {SettingsComponent && (
        <Modal
          opened={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title={`${widgetEntry.name} Settings`}
          size="md"
        >
          {/* Stop event propagation to prevent grid drag/resize interference */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <Stack gap="md">
              <Divider label="Display" labelPosition="left" />
              <Group justify="space-between">
                <Text size="sm">Transparent Background</Text>
                <Switch
                  checked={widget.config.transparentBackground === true}
                  onChange={(e) => handleConfigChange({ transparentBackground: e.currentTarget.checked })}
                />
              </Group>
              <Divider label="Settings" labelPosition="left" />
              <Suspense fallback={<WidgetLoader />}>
                <SettingsComponent
                  widget={widget}
                  isEditing={true}
                  onConfigChange={handleConfigChange}
                />
              </Suspense>
              <Button onClick={() => setSettingsOpen(false)} mt="md">
                Done
              </Button>
            </Stack>
          </div>
        </Modal>
      )}
    </>
  );
}
