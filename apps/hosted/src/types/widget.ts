import type { Photo, WidgetDefinition } from '@homeslate/widgets';

export type {
  WidgetConfig,
  WidgetDefinition,
  WidgetProps,
  WidgetRegistryEntry,
  TextAlign,
} from '@homeslate/widgets';
export type { Photo } from '@homeslate/widgets';

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
  /** Optional Tabler icon name (e.g. "IconHome") used as the view indicator on the display. Falls back to a neutral placeholder icon when not set. */
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
