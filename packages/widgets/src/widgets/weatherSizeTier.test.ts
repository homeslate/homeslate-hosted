import { describe, expect, it } from 'vitest';
import { getWeatherSectionVisibility, getWeatherSizeTier } from './weatherSizeTier';

describe('getWeatherSizeTier', () => {
  it('compact when h <= 2', () => {
    expect(getWeatherSizeTier(4, 2)).toBe('compact');
    expect(getWeatherSizeTier(2, 1)).toBe('compact');
  });

  it('medium when short or narrow', () => {
    expect(getWeatherSizeTier(4, 3)).toBe('medium');
    expect(getWeatherSizeTier(3, 5)).toBe('medium');
  });

  it('full when wide and tall enough', () => {
    expect(getWeatherSizeTier(4, 4)).toBe('full');
    expect(getWeatherSizeTier(6, 5)).toBe('full');
  });
});

describe('getWeatherSectionVisibility', () => {
  it('hides everything but current chrome in compact', () => {
    expect(getWeatherSectionVisibility('compact')).toEqual({
      showLocation: false,
      showUpdated: false,
      showDetails: false,
      showHourly: false,
      showWeekly: false,
    });
  });

  it('shows hourly but not weekly in medium', () => {
    expect(getWeatherSectionVisibility('medium')).toEqual({
      showLocation: true,
      showUpdated: true,
      showDetails: true,
      showHourly: true,
      showWeekly: false,
    });
  });

  it('shows all sections in full', () => {
    expect(getWeatherSectionVisibility('full')).toEqual({
      showLocation: true,
      showUpdated: true,
      showDetails: true,
      showHourly: true,
      showWeekly: true,
    });
  });
});
