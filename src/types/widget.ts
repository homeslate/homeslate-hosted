import type { ComponentType } from 'react';
import type { Photo } from '../widgets/PhotoWidget';

export type TextAlign = 'left' | 'center' | 'right';

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

export interface StickyNote {
  id: string;
  text: string;
  x: number; // % of container width
  y: number; // % of container height
  color: string; // preset name ('yellow'|'pink'|'blue'|'green') or hex (#rrggbb)
}

export interface DashboardLayout {
  id: string;
  name: string;
  /** Optional Tabler icon name (e.g. "IconHome") used as the view indicator on the display. Falls back to a dot when not set. */
  icon?: string;
  widgets: WidgetDefinition[];
  columns: number;
  rowHeight: number;
  hidden?: boolean;
  /** Single background image URL (legacy / single-photo mode). When backgroundPhotos has entries, this is unused. */
  backgroundImage?: string;
  backgroundImageSize?: 'cover' | 'contain' | 'tile';
  backgroundOverlayOpacity?: number;
  /** Multiple background photos for slideshow mode */
  backgroundPhotos?: Photo[];
  /** Seconds between background photo transitions */
  backgroundInterval?: number;
  notes?: StickyNote[];
}

