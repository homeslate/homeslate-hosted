import { useState, Suspense } from 'react';
import { Paper, ActionIcon, Group, Text, Modal, Stack, Button, Tooltip, Switch, Divider, Center, Loader } from '@mantine/core';
import { IconSettings, IconTrash, IconGripVertical, IconArrowsMaximize } from '@tabler/icons-react';
import type { WidgetDefinition, WidgetConfig } from '../types/widget';
import { getWidgetByType } from '../widgets/registry';
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
  const { updateWidgetConfig, removeWidget } = useDashboardStore();

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

  return (
    <>
      <Paper className={`${classes.wrapper} ${isTransparent ? classes.transparent : ''} ${isEditing ? classes.editing : ''}`}>
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
