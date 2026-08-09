import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  fetchWeatherCached, 
  type WeatherData,
} from '../services/weather';
import { sliceHourlyFromNow } from '../services/hourlyForecast';
import { getNextPollDelay } from './polling';

interface UseWeatherOptions {
  latitude: number | null;
  longitude: number | null;
  units: 'imperial' | 'metric';
  locationInfo?: { name: string; country: string; admin1?: string };
  refreshInterval?: number; // in milliseconds
}

interface UseWeatherResult {
  data: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

const HOURLY_FORECAST_COUNT = 24;

function withHourlySlice(data: WeatherData, now: Date): WeatherData {
  const hourly = sliceHourlyFromNow({
    times: data.hourly.map((h) => h.time),
    values: data.hourly,
    now,
    utcOffsetSeconds: data.utcOffsetSeconds,
    count: HOURLY_FORECAST_COUNT,
  });
  return { ...data, hourly };
}

function msUntilNextLocationHour(now: Date, utcOffsetSeconds: number): number {
  const shiftedMs = now.getTime() + utcOffsetSeconds * 1000;
  const shifted = new Date(shiftedMs);
  shifted.setUTCMinutes(0, 0, 0);
  shifted.setUTCHours(shifted.getUTCHours() + 1);
  const nextHourMs = shifted.getTime() - utcOffsetSeconds * 1000;
  return Math.max(0, nextHourMs - now.getTime()) + 1;
}

export function useWeather({
  latitude,
  longitude,
  units,
  locationInfo,
  refreshInterval = 10 * 60 * 1000, // 10 minutes default
}: UseWeatherOptions): UseWeatherResult {
  const [rawData, setRawData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const fetchData = useCallback(async () => {
    if (latitude === null || longitude === null) {
      setRawData(null);
      setError(null);
      setLastUpdated(null);
      setConsecutiveFailures(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const weatherData = await fetchWeatherCached(
        latitude,
        longitude,
        units,
        locationInfo
      );
      setRawData(weatherData);
      setLastUpdated(Date.now());
      setConsecutiveFailures(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather');
      setConsecutiveFailures((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude, units, locationInfo]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (latitude === null || longitude === null) return;

    const interval = setTimeout(fetchData, getNextPollDelay(refreshInterval, consecutiveFailures));
    return () => clearTimeout(interval);
  }, [fetchData, refreshInterval, latitude, longitude, consecutiveFailures]);

  // Re-slice hourly forecast at each new hour in the widget location's timezone
  useEffect(() => {
    if (rawData === null) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextHour = () => {
      const current = new Date();
      setNow(current);
      timeoutId = setTimeout(
        scheduleNextHour,
        msUntilNextLocationHour(current, rawData.utcOffsetSeconds),
      );
    };

    scheduleNextHour();
    return () => clearTimeout(timeoutId);
  }, [rawData]);

  const data = useMemo(
    () => (rawData ? withHourlySlice(rawData, now) : null),
    [rawData, now],
  );

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchData,
  };
}

