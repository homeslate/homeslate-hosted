import { useState, useEffect, useCallback } from 'react';
import { 
  fetchWeatherCached, 
  type WeatherData,
} from '../services/weather';

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
  refresh: () => void;
}

export function useWeather({
  latitude,
  longitude,
  units,
  locationInfo,
  refreshInterval = 10 * 60 * 1000, // 10 minutes default
}: UseWeatherOptions): UseWeatherResult {
  const [data, setData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (latitude === null || longitude === null) {
      setData(null);
      setError(null);
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
      setData(weatherData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather');
      setData(null);
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
    
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, latitude, longitude]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
}

