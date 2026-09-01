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
