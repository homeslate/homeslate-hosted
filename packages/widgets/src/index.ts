export const WIDGETS_PACKAGE_NAME = '@homeslate/widgets';

export type {
  TextAlign,
  WidgetConfig,
  WidgetDefinition,
  WidgetProps,
  WidgetRegistryEntry,
} from './types';

export {
  clearWidgetRegistry,
  getWidgetByType,
  getWidgetTypes,
  registerWidget,
} from './registry';

export type { GoogleRuntime } from './googleRuntime';
export {
  DEFAULT_GOOGLE_RUNTIME,
  GoogleRuntimeProvider,
  useGoogleRuntime,
} from './googleRuntime';
