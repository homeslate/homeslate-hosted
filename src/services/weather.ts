// Open-Meteo Weather API Service
// Free for non-commercial use, commercial plans available
// https://open-meteo.com/

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // State/province
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
}

export interface HourlyForecast {
  time: string; // ISO datetime
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

export interface AirQualityData {
  usAqi: number;
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast[]; // next 12 hours
  location: {
    name: string;
    country: string;
    admin1?: string;
  };
  units: 'imperial' | 'metric';
  airQuality?: AirQualityData;
}

// Weather code to description mapping (WMO codes)
export const weatherCodeMap: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: 'sunny' },
  1: { description: 'Mainly clear', icon: 'sunny' },
  2: { description: 'Partly cloudy', icon: 'cloudy' },
  3: { description: 'Overcast', icon: 'cloudy' },
  45: { description: 'Foggy', icon: 'cloudy' },
  48: { description: 'Depositing rime fog', icon: 'cloudy' },
  51: { description: 'Light drizzle', icon: 'rainy' },
  53: { description: 'Moderate drizzle', icon: 'rainy' },
  55: { description: 'Dense drizzle', icon: 'rainy' },
  56: { description: 'Light freezing drizzle', icon: 'rainy' },
  57: { description: 'Dense freezing drizzle', icon: 'rainy' },
  61: { description: 'Slight rain', icon: 'rainy' },
  63: { description: 'Moderate rain', icon: 'rainy' },
  65: { description: 'Heavy rain', icon: 'rainy' },
  66: { description: 'Light freezing rain', icon: 'rainy' },
  67: { description: 'Heavy freezing rain', icon: 'rainy' },
  71: { description: 'Slight snow', icon: 'snowy' },
  73: { description: 'Moderate snow', icon: 'snowy' },
  75: { description: 'Heavy snow', icon: 'snowy' },
  77: { description: 'Snow grains', icon: 'snowy' },
  80: { description: 'Slight rain showers', icon: 'rainy' },
  81: { description: 'Moderate rain showers', icon: 'rainy' },
  82: { description: 'Violent rain showers', icon: 'rainy' },
  85: { description: 'Slight snow showers', icon: 'snowy' },
  86: { description: 'Heavy snow showers', icon: 'snowy' },
  95: { description: 'Thunderstorm', icon: 'stormy' },
  96: { description: 'Thunderstorm with slight hail', icon: 'stormy' },
  99: { description: 'Thunderstorm with heavy hail', icon: 'stormy' },
};

export function getWeatherDescription(code: number): string {
  return weatherCodeMap[code]?.description ?? 'Unknown';
}

export function getWeatherIcon(code: number): string {
  return weatherCodeMap[code]?.icon ?? 'cloudy';
}

/**
 * Search for locations by name using Open-Meteo Geocoding API
 */
export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];
  
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    admin1: r.admin1,
  }));
}

/**
 * Fetch weather data from Open-Meteo API
 */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  units: 'imperial' | 'metric' = 'imperial',
  locationInfo?: { name: string; country: string; admin1?: string }
): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  
  // Set coordinates
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  
  // Current weather parameters
  url.searchParams.set('current', [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'weather_code',
    'wind_speed_10m',
    'is_day',
  ].join(','));
  
  // Daily forecast parameters
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max',
  ].join(','));

  // Hourly forecast (next 12 hours: temperature + weather icon)
  url.searchParams.set('hourly', [
    'temperature_2m',
    'weather_code',
    'is_day',
  ].join(','));
  
  // Units
  if (units === 'imperial') {
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');
  }
  
  // Timezone
  url.searchParams.set('timezone', 'auto');
  
  // Forecast days
  url.searchParams.set('forecast_days', '7');

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Weather fetch failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Next 12 hours from hourly arrays (API returns 168 by default)
  const hourlyCount = 12;
  const hourlyTimes = (data.hourly?.time ?? []).slice(0, hourlyCount);
  const hourly: HourlyForecast[] = hourlyTimes.map((time: string, i: number) => ({
    time,
    temperature: Math.round(data.hourly.temperature_2m[i]),
    weatherCode: data.hourly.weather_code[i],
    isDay: data.hourly.is_day[i] === 1,
  }));

  return {
    current: {
      temperature: Math.round(data.current.temperature_2m),
      apparentTemperature: Math.round(data.current.apparent_temperature),
      humidity: data.current.relative_humidity_2m,
      windSpeed: Math.round(data.current.wind_speed_10m),
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
    },
    daily: data.daily.time.map((date: string, i: number) => ({
      date,
      weatherCode: data.daily.weather_code[i],
      tempMax: Math.round(data.daily.temperature_2m_max[i]),
      tempMin: Math.round(data.daily.temperature_2m_min[i]),
      precipitationProbability: data.daily.precipitation_probability_max[i],
    })),
    hourly,
    location: locationInfo ?? {
      name: 'Unknown',
      country: '',
    },
    units,
  };
}

/**
 * Fetch US AQI from Open-Meteo Air Quality API
 */
export async function fetchAirQuality(latitude: number, longitude: number): Promise<AirQualityData> {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set('current', 'us_aqi');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Air quality fetch failed: ${response.statusText}`);
  const data = await response.json();
  return { usAqi: data.current?.us_aqi ?? 0 };
}

// Simple in-memory cache for weather data
const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function fetchWeatherCached(
  latitude: number,
  longitude: number,
  units: 'imperial' | 'metric' = 'imperial',
  locationInfo?: { name: string; country: string; admin1?: string }
): Promise<WeatherData> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)},${units}`;
  const cached = weatherCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetchWeather(latitude, longitude, units, locationInfo);
  weatherCache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}

