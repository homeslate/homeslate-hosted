import { useState, useMemo, useEffect } from 'react';
import { 
  Box, 
  Text, 
  Stack, 
  TextInput, 
  Select, 
  Switch, 
  NumberInput, 
  Group,
  Loader,
  Button,
  Paper,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { 
  IconSun, 
  IconCloud, 
  IconCloudRain, 
  IconSnowflake,
  IconWind,
  IconDroplet,
  IconCloudStorm,
  IconRefresh,
  IconMapPin,
} from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig, TextAlign } from '../types/widget';
import { useWeather } from '../hooks/useWeather';
import {
  searchLocations,
  getWeatherDescription,
  getWeatherIcon,
  fetchAirQuality,
  type GeocodingResult,
  type AirQualityData,
} from '../services/weather';
import classes from './WeatherWidget.module.css';

export interface WeatherConfig extends WidgetConfig {
  location: string;
  latitude: number | null;
  longitude: number | null;
  units: 'imperial' | 'metric';
  showForecast: boolean;
  forecastDays: number;
  transparentBackground: boolean;
  showAirQuality: boolean;
  textAlign: TextAlign;
}

interface AqiBand {
  max: number;
  label: string;
  color: string;
}

const AQI_BANDS: AqiBand[] = [
  { max: 50,  label: 'Good',                       color: '#22c55e' },
  { max: 100, label: 'Moderate',                   color: '#eab308' },
  { max: 150, label: 'Unhealthy for Sensitive',    color: '#f97316' },
  { max: 200, label: 'Unhealthy',                  color: '#ef4444' },
  { max: 300, label: 'Very Unhealthy',             color: '#a855f7' },
  { max: Infinity, label: 'Hazardous',             color: '#7f1d1d' },
];

function getAqiBand(aqi: number): AqiBand {
  return AQI_BANDS.find((b) => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
}

const WeatherIcon = ({ condition, size = 48, isDay = true }: { condition: string; size?: number; isDay?: boolean }) => {
  const iconProps = { size, strokeWidth: 1.5 };
  
  switch (condition.toLowerCase()) {
    case 'sunny':
      return <IconSun {...iconProps} className={isDay ? classes.iconSunny : classes.iconMoon} />;
    case 'rainy':
      return <IconCloudRain {...iconProps} className={classes.iconRainy} />;
    case 'snowy':
      return <IconSnowflake {...iconProps} className={classes.iconSnowy} />;
    case 'stormy':
      return <IconCloudStorm {...iconProps} className={classes.iconStormy} />;
    case 'cloudy':
    default:
      return <IconCloud {...iconProps} className={classes.iconCloudy} />;
  }
};

export function WeatherWidget({ widget }: WidgetProps<WeatherConfig>) {
  const { latitude, longitude, units, showForecast, forecastDays, location, transparentBackground, showAirQuality, textAlign = 'left' } = widget.config;
  const [aqData, setAqData] = useState<AirQualityData | null>(null);

  useEffect(() => {
    if (!showAirQuality || latitude === null || longitude === null) {
      setAqData(null);
      return;
    }
    fetchAirQuality(latitude, longitude)
      .then(setAqData)
      .catch(() => setAqData(null));
  }, [showAirQuality, latitude, longitude]);
  
  const locationInfo = useMemo(() => {
    if (!location) return undefined;
    // Parse stored location string (format: "City, State, Country")
    const parts = location.split(', ');
    return {
      name: parts[0] || location,
      admin1: parts[1],
      country: parts[2] || parts[1] || '',
    };
  }, [location]);

  const { data: weather, isLoading, error, refresh } = useWeather({
    latitude,
    longitude,
    units,
    locationInfo,
  });

  const tempUnit = units === 'metric' ? '°C' : '°F';
  const windUnit = units === 'metric' ? 'km/h' : 'mph';

  // No location configured
  if (!latitude || !longitude) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconMapPin size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Location Set</Text>
          <Text size="sm" c="dimmed">
            Configure a location in widget settings
          </Text>
        </div>
      </Box>
    );
  }

  // Loading state
  if (isLoading && !weather) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.loading}>
          <Loader size="lg" color="orange" />
          <Text size="sm" c="dimmed" mt="sm">Loading weather...</Text>
        </div>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.error}>
          <Text size="sm" c="red">{error}</Text>
          <Button 
            variant="light" 
            color="orange" 
            size="xs" 
            mt="sm"
            leftSection={<IconRefresh size={14} />}
            onClick={refresh}
          >
            Retry
          </Button>
        </div>
      </Box>
    );
  }

  if (!weather) return null;

  const iconCondition = getWeatherIcon(weather.current.weatherCode);
  const description = getWeatherDescription(weather.current.weatherCode);

  const alignClass = textAlign === 'center' ? classes.alignCenter : textAlign === 'right' ? classes.alignRight : classes.alignLeft;

  // Hide weekly forecast when widget is small (3x3 or smaller) to avoid crowding
  const { w, h } = widget.layout;
  const isSmallWidget = w <= 3 && h <= 3;
  const showWeeklyForecast = showForecast && !isSmallWidget;

  // Compact layout for very short widgets (row height 2) to prevent overlap
  const isCompact = h <= 2;

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''} ${alignClass} ${isCompact ? classes.compact : ''}`}>
      {!isCompact && (
      <div className={classes.header}>
        <Text className={classes.location}>
          {weather.location.name}
          {weather.location.admin1 && `, ${weather.location.admin1}`}
        </Text>
        {isLoading && <Loader size="xs" color="orange" />}
      </div>
      )}
      
      <div className={classes.current}>
        <div className={classes.mainTemp}>
          <WeatherIcon condition={iconCondition} size={isCompact ? 36 : 64} isDay={weather.current.isDay} />
          <div>
            <Text className={classes.temperature}>
              {weather.current.temperature}{tempUnit}
            </Text>
            <Text className={classes.condition}>{description}</Text>
          </div>
        </div>
        
        {!isCompact && (
        <div className={classes.details}>
          <div className={classes.detailItem}>
            <IconDroplet size={16} />
            <Text size="sm">{weather.current.humidity}%</Text>
          </div>
          <div className={classes.detailItem}>
            <IconWind size={16} />
            <Text size="sm">{weather.current.windSpeed} {windUnit}</Text>
          </div>
          <div className={classes.detailItem}>
            <Text size="sm" c="dimmed">Feels {weather.current.apparentTemperature}°</Text>
          </div>
        </div>
        )}

        {!isCompact && showAirQuality && aqData !== null && (() => {
          const band = getAqiBand(aqData.usAqi);
          return (
            <div className={classes.aqiBadge} style={{ borderColor: band.color }}>
              <span className={classes.aqiDot} style={{ background: band.color }} />
              <Text size="xs" fw={600} style={{ color: band.color }}>AQI {aqData.usAqi}</Text>
              <Text size="xs" c="dimmed">{band.label}</Text>
            </div>
          );
        })()}
      </div>
      
      {showWeeklyForecast && weather.daily.length > 1 && (
        <div className={classes.forecast}>
          {weather.daily.slice(1, forecastDays + 1).map((day, index) => {
            const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
            const dayIcon = getWeatherIcon(day.weatherCode);
            return (
              <div key={index} className={classes.forecastDay}>
                <Text size="xs" fw={500}>{dayName}</Text>
                <WeatherIcon condition={dayIcon} size={24} />
                <Text size="xs">{day.tempMax}°</Text>
                <Text size="xs" c="dimmed">{day.tempMin}°</Text>
              </div>
            );
          })}
        </div>
      )}
    </Box>
  );
}

export function WeatherWidgetSettings({ widget, onConfigChange }: WidgetProps<WeatherConfig>) {
  const { location, units, showForecast, forecastDays, showAirQuality, textAlign = 'left' } = widget.config;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search for locations when query changes
  const handleSearch = async () => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchLocations(debouncedQuery);
      setSearchResults(results);
    } catch (err) {
      console.error('Location search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Trigger search on debounced query change
  useState(() => {
    handleSearch();
  });

  // Effect to search when debouncedQuery changes
  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      setIsSearching(true);
      searchLocations(value)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]);
    }
  };

  const selectLocation = (result: GeocodingResult) => {
    const locationString = [
      result.name,
      result.admin1,
      result.country,
    ].filter(Boolean).join(', ');

    onConfigChange({
      location: locationString,
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <Stack gap="md">
      <div>
        <TextInput
          label="Search Location"
          placeholder="Enter city name..."
          value={searchQuery}
          onChange={(e) => handleQueryChange(e.currentTarget.value)}
          rightSection={isSearching ? <Loader size="xs" /> : null}
        />
        
        {searchResults.length > 0 && (
          <Paper className={classes.searchResults} mt="xs" p="xs">
            <Stack gap={4}>
              {searchResults.map((result) => (
                <Button
                  key={result.id}
                  variant="subtle"
                  size="sm"
                  fullWidth
                  justify="flex-start"
                  onClick={() => selectLocation(result)}
                  className={classes.searchResult}
                >
                  <IconMapPin size={14} style={{ marginRight: 8 }} />
                  {result.name}
                  {result.admin1 && `, ${result.admin1}`}
                  {result.country && ` · ${result.country}`}
                </Button>
              ))}
            </Stack>
          </Paper>
        )}
      </div>

      {location && (
        <Paper p="sm" className={classes.currentLocation}>
          <Group gap="xs">
            <IconMapPin size={16} />
            <div>
              <Text size="xs" c="dimmed">Current Location</Text>
              <Text size="sm" fw={500}>{location}</Text>
            </div>
          </Group>
        </Paper>
      )}

      <Select
        label="Temperature Units"
        data={[
          { value: 'imperial', label: 'Fahrenheit (°F)' },
          { value: 'metric', label: 'Celsius (°C)' },
        ]}
        value={units}
        onChange={(value) => onConfigChange({ units: (value as 'imperial' | 'metric') || 'imperial' })}
      />
      
      <Group justify="space-between">
        <Text size="sm">Show Forecast</Text>
        <Switch
          checked={showForecast}
          onChange={(e) => onConfigChange({ showForecast: e.currentTarget.checked })}
        />
      </Group>
      
      {showForecast && (
        <NumberInput
          label="Forecast Days"
          min={1}
          max={6}
          value={forecastDays}
          onChange={(value) => onConfigChange({ forecastDays: Number(value) || 5 })}
        />
      )}

      <Group justify="space-between">
        <Text size="sm">Show Air Quality (US AQI)</Text>
        <Switch
          checked={showAirQuality ?? false}
          onChange={(e) => onConfigChange({ showAirQuality: e.currentTarget.checked })}
        />
      </Group>
      <Select
        label="Text Alignment"
        data={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        value={textAlign}
        onChange={(value) => onConfigChange({ textAlign: (value as TextAlign) || 'left' })}
      />
    </Stack>
  );
}
