import { registerWidgetConfigSchema } from '@homeslate/schema';
import type { WidgetConfig, WidgetRegistryEntry } from './types';

const widgetRegistry = new Map<string, WidgetRegistryEntry<WidgetConfig>>();

export function registerWidget<T extends WidgetConfig>(entry: WidgetRegistryEntry<T>): void {
  widgetRegistry.set(entry.type, entry as unknown as WidgetRegistryEntry<WidgetConfig>);
  if (entry.configSchema) {
    registerWidgetConfigSchema(entry.type, entry.configSchema);
  }
}

export function getWidgetTypes(): WidgetRegistryEntry<WidgetConfig>[] {
  return Array.from(widgetRegistry.values());
}

export function getWidgetByType(type: string): WidgetRegistryEntry<WidgetConfig> | undefined {
  return widgetRegistry.get(type);
}

export function clearWidgetRegistry(): void {
  widgetRegistry.clear();
}
