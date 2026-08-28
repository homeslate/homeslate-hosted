export type ColorMode = 'dark' | 'light';

export type HolidayId =
  | 'new-years-day'
  | 'valentines-day'
  | 'st-patricks-day'
  | 'independence-day'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas'
  | 'new-years-eve';

export type AlarmToneId = 'chime' | 'bell' | 'radar';

export type AlarmDefinition = {
  id: string;
  label: string;
  enabled: boolean;
  time: string;
  days: number[];
  toneId: AlarmToneId;
};

export type StickyNote = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
};

export type WidgetLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

export type WidgetInstance = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  layout: WidgetLayout;
};

export type ViewBackground = {
  image?: string;
  imageSize?: 'cover' | 'contain' | 'tile';
  overlayOpacity?: number;
  photos?: unknown[];
  intervalSeconds?: number;
};

export type View = {
  id: string;
  name: string;
  icon?: string;
  hidden?: boolean;
  columns: number;
  rowHeight: number;
  widgets: WidgetInstance[];
  background?: ViewBackground;
  notes?: StickyNote[];
};

export type DisplayDocument = {
  schemaVersion: 1;
  name: string;
  views: View[];
  activeViewId: string | null;
  rotation: { enabled: boolean; intervalMs: number };
  themes: unknown[];
  activeThemeId: string | null;
  colorMode?: ColorMode;
  settings: {
    stickyNotesEnabled?: boolean;
    voiceEnabled?: boolean;
    holidayEffectsEnabled?: boolean;
    holidayPreviewId?: HolidayId;
  };
  alarms?: AlarmDefinition[];
};
