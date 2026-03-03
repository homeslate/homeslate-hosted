import type { ComponentType } from 'react';

export interface WidgetConfig {
  [key: string]: unknown;
}

export interface WidgetDefinition<T extends WidgetConfig = WidgetConfig> {
  id: string;
  type: string;
  title: string;
  config: T;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
}

export interface WidgetProps<T extends WidgetConfig = WidgetConfig> {
  widget: WidgetDefinition<T>;
  isEditing: boolean;
  onConfigChange: (config: Partial<T>) => void;
}

export interface WidgetRegistryEntry<T extends WidgetConfig = WidgetConfig> {
  type: string;
  name: string;
  description: string;
  icon: ComponentType<{ size?: number | string }>;
  component: ComponentType<WidgetProps<T>>;
  settingsComponent?: ComponentType<WidgetProps<T>>;
  defaultConfig: T;
  defaultLayout: {
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetDefinition[];
  columns: number;
  rowHeight: number;
  hidden?: boolean;
}

