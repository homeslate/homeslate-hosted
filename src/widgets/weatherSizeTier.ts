export type WeatherSizeTier = 'compact' | 'medium' | 'full';

export function getWeatherSizeTier(w: number, h: number): WeatherSizeTier {
  if (h <= 2) return 'compact';
  if (h <= 3 || w <= 3) return 'medium';
  return 'full';
}

export function getWeatherSectionVisibility(tier: WeatherSizeTier): {
  showLocation: boolean;
  showUpdated: boolean;
  showDetails: boolean;
  showHourly: boolean;
  showWeekly: boolean;
} {
  switch (tier) {
    case 'compact':
      return {
        showLocation: false,
        showUpdated: false,
        showDetails: false,
        showHourly: false,
        showWeekly: false,
      };
    case 'medium':
      return {
        showLocation: true,
        showUpdated: true,
        showDetails: true,
        showHourly: true,
        showWeekly: false,
      };
    case 'full':
      return {
        showLocation: true,
        showUpdated: true,
        showDetails: true,
        showHourly: true,
        showWeekly: true,
      };
  }
}
