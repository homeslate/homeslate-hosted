import { describe, expect, it } from 'vitest';
import { getWidgetByType } from './registry';
import { unknownWidgetLabel } from './UnknownWidget';

describe('unknown widgets', () => {
  it('does not resolve an unregistered type', () => {
    expect(getWidgetByType('mystery-widget')).toBeUndefined();
  });

  it('labels the missing type', () => {
    expect(unknownWidgetLabel('mystery-widget')).toBe('Unknown widget type: mystery-widget');
  });
});
