import { useState } from 'react';
import { Paper, ActionIcon, Group, Text, Modal, Stack, Button, Tooltip } from '@mantine/core';
import { IconSettings, IconTrash, IconGripVertical, IconArrowsMaximize } from '@tabler/icons-react';
import type { WidgetDefinition, WidgetConfig } from '../types/widget';
import { getWidgetByType } from '../widgets/registry';
import { useDashboardStore } from '../store/dashboardStore';
import classes from './WidgetWrapper.module.css';

interface WidgetWrapperProps {
  widget: WidgetDefinition;
}

export function WidgetWrapper({ widget }: WidgetWrapperProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isEditing, updateWidgetConfig, removeWidget } = useDashboardStore();
  
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

  const handleConfigChange = (config: Partial<WidgetConfig>) => {
    updateWidgetConfig(widget.id, config);
  };

  return (
    <>
      <Paper className={`${classes.wrapper} ${isEditing ? classes.editing : ''}`}>
        {isEditing && (
          <>
            <div className={classes.toolbar}>
              <Group gap="xs">
                <div className={`${classes.dragHandle} widget-drag-handle`}>
                  <IconGripVertical size={16} />
                </div>
                <Text size="xs" c="dimmed" className={classes.widgetName}>
                  {widgetEntry.name}
                </Text>
              </Group>
              <Group gap="xs">
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
          <WidgetComponent 
            widget={widget} 
            isEditing={isEditing}
            onConfigChange={handleConfigChange}
          />
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
              <SettingsComponent
                widget={widget}
                isEditing={true}
                onConfigChange={handleConfigChange}
              />
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

