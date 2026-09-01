import { Paper, Text, SimpleGrid, UnstyledButton, Stack } from '@mantine/core';
import { getWidgetTypes } from '@homeslate/widgets';
import { useDashboardStore } from '../store/dashboardStore';
import classes from './AddWidgetPanel.module.css';

export function AddWidgetPanel() {
  const { addWidget } = useDashboardStore();
  const widgetTypes = getWidgetTypes();

  const handleAddWidget = (type: string) => {
    const widgetDef = widgetTypes.find(w => w.type === type);
    if (widgetDef) {
      addWidget(type, widgetDef.defaultConfig, {
        x: 0,
        y: 0,
        w: widgetDef.defaultLayout.w,
        h: widgetDef.defaultLayout.h,
        minW: widgetDef.defaultLayout.minW,
        minH: widgetDef.defaultLayout.minH,
        maxW: widgetDef.defaultLayout.maxW,
        maxH: widgetDef.defaultLayout.maxH,
      });
    }
  };

  return (
    <Paper className={classes.panel} p="md">
      <Text size="sm" fw={600} mb="md" className={classes.title}>
        Add Widgets
      </Text>
      <SimpleGrid cols={2} spacing="sm">
        {widgetTypes.map((widget) => {
          const Icon = widget.icon;
          return (
            <UnstyledButton
              key={widget.type}
              className={classes.widgetButton}
              onClick={() => handleAddWidget(widget.type)}
            >
              <Stack gap={4} align="center">
                <Icon size={28} />
                <Text size="xs" fw={500}>{widget.name}</Text>
              </Stack>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Paper>
  );
}

