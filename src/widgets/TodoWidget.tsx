import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, Stack, TextInput, Switch, Group, ActionIcon } from '@mantine/core';
import { IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import classes from './TodoWidget.module.css';

export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface TodoConfig extends WidgetConfig {
  items: TodoItem[];
  hideCompleted: boolean;
  transparentBackground: boolean;
}

function getLocalChecked(widgetId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`todo_checked_${widgetId}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveLocalChecked(widgetId: string, checked: Set<string>) {
  localStorage.setItem(`todo_checked_${widgetId}`, JSON.stringify([...checked]));
}

export function TodoWidget({ widget, isEditing, onConfigChange }: WidgetProps<TodoConfig>) {
  const { items, hideCompleted, transparentBackground } = widget.config;
  const [localChecked, setLocalChecked] = useState<Set<string>>(() => getLocalChecked(widget.id));
  const [newItemText, setNewItemText] = useState('');
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Re-read localStorage whenever items change externally (poll/config update)
  useEffect(() => {
    setLocalChecked(getLocalChecked(widget.id));
  }, [widget.id, items]);

  const mergedItems = items.map((item) => ({
    ...item,
    checked: isEditing ? item.checked : localChecked.has(item.id),
  }));

  const displayItems = hideCompleted ? mergedItems.filter((i) => !i.checked) : mergedItems;

  const handleToggle = useCallback(
    (id: string) => {
      if (isEditing) {
        onConfigChange({
          items: itemsRef.current.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
        });
      } else {
        setLocalChecked((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          saveLocalChecked(widget.id, next);
          return next;
        });
      }
    },
    [isEditing, onConfigChange, widget.id]
  );

  const handleAddItem = useCallback(() => {
    const text = newItemText.trim();
    if (!text) return;
    onConfigChange({ items: [...itemsRef.current, { id: uuidv4(), text, checked: false }] });
    setNewItemText('');
  }, [newItemText, onConfigChange]);

  const handleRemoveItem = useCallback(
    (id: string) => {
      onConfigChange({ items: itemsRef.current.filter((i) => i.id !== id) });
    },
    [onConfigChange]
  );

  const allDone = items.length > 0 && items.every((i) => localChecked.has(i.id));

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      <Stack gap={4} className={classes.list}>
        {displayItems.map((item) => (
          <div key={item.id} className={classes.itemRow}>
            <button
              className={`${classes.item} ${item.checked ? classes.itemChecked : ''}`}
              onClick={() => handleToggle(item.id)}
            >
              <span className={`${classes.checkbox} ${item.checked ? classes.checkboxChecked : ''}`}>
                {item.checked && <IconCheck size={11} strokeWidth={3} />}
              </span>
              <Text className={classes.itemText} size="sm">
                {item.text}
              </Text>
            </button>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              className={classes.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveItem(item.id);
              }}
              aria-label="Delete item"
            >
              <IconX size={14} />
            </ActionIcon>
          </div>
        ))}
        <Group gap="xs" wrap="nowrap" className={classes.addRow}>
          <TextInput
            size="xs"
            placeholder="Add item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            style={{ flex: 1 }}
          />
          <ActionIcon variant="light" size="md" onClick={handleAddItem} disabled={!newItemText.trim()}>
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
      </Stack>
      {allDone && displayItems.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" mt="xs">
          All done! ✓
        </Text>
      )}
    </Box>
  );
}

export function TodoWidgetSettings({ widget, onConfigChange }: WidgetProps<TodoConfig>) {
  const { hideCompleted, transparentBackground } = widget.config;

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">
        Add, remove, and check off items directly on the display.
      </Text>

      <Group justify="space-between">
        <Text size="sm">Hide completed items</Text>
        <Switch
          checked={hideCompleted}
          onChange={(e) => onConfigChange({ hideCompleted: e.currentTarget.checked })}
        />
      </Group>

      <Group justify="space-between">
        <Text size="sm">Transparent background</Text>
        <Switch
          checked={transparentBackground}
          onChange={(e) => onConfigChange({ transparentBackground: e.currentTarget.checked })}
        />
      </Group>
    </Stack>
  );
}
