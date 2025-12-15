import { Group, Button, Text, Select, ActionIcon, Tooltip } from '@mantine/core';
import { IconEdit, IconCheck, IconPlus, IconLayoutDashboard } from '@tabler/icons-react';
import { useDashboardStore } from '../store/dashboardStore';
import classes from './Header.module.css';

export function Header() {
  const { 
    layouts, 
    activeLayoutId, 
    isEditing, 
    setActiveLayout, 
    toggleEditing,
    createLayout 
  } = useDashboardStore();

  const layoutOptions = layouts.map(l => ({
    value: l.id,
    label: l.name,
  }));

  const handleNewLayout = () => {
    const name = prompt('Enter layout name:');
    if (name) {
      createLayout(name);
    }
  };

  return (
    <header className={classes.header}>
      <Group gap="md">
        <IconLayoutDashboard size={28} className={classes.logo} />
        <Text className={classes.title}>Kitchen Display</Text>
      </Group>

      <Group gap="sm">
        <Select
          data={layoutOptions}
          value={activeLayoutId}
          onChange={(value) => value && setActiveLayout(value)}
          placeholder="Select layout"
          size="sm"
          w={180}
          classNames={{
            input: classes.selectInput,
          }}
        />
        
        <Tooltip label="New Layout">
          <ActionIcon 
            variant="subtle" 
            onClick={handleNewLayout}
            className={classes.actionButton}
          >
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>

        <Button
          variant={isEditing ? 'filled' : 'light'}
          color={isEditing ? 'green' : 'indigo'}
          leftSection={isEditing ? <IconCheck size={18} /> : <IconEdit size={18} />}
          onClick={toggleEditing}
          className={classes.editButton}
        >
          {isEditing ? 'Done' : 'Edit Layout'}
        </Button>
      </Group>
    </header>
  );
}

