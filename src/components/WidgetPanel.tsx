import { useState } from 'react';
import { Stack, Text, UnstyledButton, Tooltip, ActionIcon } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { getWidgetTypes } from '../widgets/registry';
import { useDashboardStore } from '../store/dashboardStore';
import classes from './WidgetPanel.module.css';

export function WidgetPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { addWidget } = useDashboardStore();
  const widgetTypes = getWidgetTypes();

  const handleAddWidget = (type: string) => {
    const widgetDef = widgetTypes.find((w) => w.type === type);
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
    <aside className={`${classes.panel} ${collapsed ? classes.collapsed : ''}`}>
      <div className={classes.toggleBar}>
        <ActionIcon
          variant="subtle"
          onClick={() => setCollapsed((c) => !c)}
          className={classes.toggleBtn}
          title={collapsed ? 'Expand widget panel' : 'Collapse widget panel'}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </ActionIcon>
      </div>

      {collapsed ? (
        <Stack gap={4} align="center" pt="xs">
          {widgetTypes.map((widget) => {
            const Icon = widget.icon;
            return (
              <Tooltip key={widget.type} label={widget.name} position="right">
                <UnstyledButton
                  className={classes.iconOnly}
                  onClick={() => handleAddWidget(widget.type)}
                >
                  <Icon size={20} />
                </UnstyledButton>
              </Tooltip>
            );
          })}
        </Stack>
      ) : (
        <div className={classes.content}>
          <Text size="xs" fw={600} c="dimmed" className={classes.panelTitle}>
            ADD WIDGETS
          </Text>
          <Stack gap={2}>
            {widgetTypes.map((widget) => {
              const Icon = widget.icon;
              return (
                <UnstyledButton
                  key={widget.type}
                  className={classes.widgetRow}
                  onClick={() => handleAddWidget(widget.type)}
                >
                  <div className={classes.widgetIcon}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <Text size="sm" fw={500}>{widget.name}</Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>{widget.description}</Text>
                  </div>
                </UnstyledButton>
              );
            })}
          </Stack>
        </div>
      )}
    </aside>
  );
}
