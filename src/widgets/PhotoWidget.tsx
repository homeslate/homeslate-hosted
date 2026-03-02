import { useState, useEffect, useCallback } from 'react';
import { Box, Text, Stack, TextInput, NumberInput, Select, Switch, Button, Group, ActionIcon } from '@mantine/core';
import { IconTrash, IconPlus, IconPhoto } from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import classes from './PhotoWidget.module.css';

export interface PhotoConfig extends WidgetConfig {
  photos: Array<{ url: string; caption?: string }>;
  interval: number;
  transition: 'fade' | 'slide' | 'none';
  showCaption: boolean;
  transparentBackground: boolean;
}

// Sample photos for demo
const samplePhotos = [
  { 
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
    caption: 'Mountain Sunrise'
  },
  { 
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
    caption: 'Ocean Waves'
  },
  { 
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop',
    caption: 'Forest Path'
  },
  { 
    url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&h=600&fit=crop',
    caption: 'Golden Fields'
  },
];

export function PhotoWidget({ widget }: WidgetProps<PhotoConfig>) {
  const { photos, interval, transition, showCaption, transparentBackground } = widget.config;
  const displayPhotos = photos.length > 0 ? photos : samplePhotos;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const nextPhoto = useCallback(() => {
    if (displayPhotos.length <= 1) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % displayPhotos.length);
      setIsTransitioning(false);
    }, 500);
  }, [displayPhotos.length]);

  useEffect(() => {
    if (displayPhotos.length <= 1) return;
    
    const timer = setInterval(nextPhoto, interval * 1000);
    return () => clearInterval(timer);
  }, [interval, nextPhoto, displayPhotos.length]);

  const currentPhoto = displayPhotos[currentIndex];

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      <div 
        className={`${classes.photo} ${isTransitioning ? classes[transition] : ''}`}
        style={{ backgroundImage: `url(${currentPhoto.url})` }}
      />
      <div className={classes.overlay} />
      {showCaption && currentPhoto.caption && (
        <div className={classes.caption}>
          <Text className={classes.captionText}>{currentPhoto.caption}</Text>
        </div>
      )}
      {displayPhotos.length > 1 && (
        <div className={classes.dots}>
          {displayPhotos.map((_, index) => (
            <button
              key={index}
              className={`${classes.dot} ${index === currentIndex ? classes.activeDot : ''}`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
      {photos.length === 0 && (
        <div className={classes.demoNotice}>
          <IconPhoto size={16} />
          <Text size="xs">Demo photos - add your own in settings</Text>
        </div>
      )}
    </Box>
  );
}

export function PhotoWidgetSettings({ widget, onConfigChange }: WidgetProps<PhotoConfig>) {
  const { photos, interval, transition, showCaption } = widget.config;
  const [newUrl, setNewUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');

  const addPhoto = () => {
    if (!newUrl) return;
    onConfigChange({
      photos: [...photos, { url: newUrl, caption: newCaption || undefined }],
    });
    setNewUrl('');
    setNewCaption('');
  };

  const removePhoto = (index: number) => {
    onConfigChange({
      photos: photos.filter((_, i) => i !== index),
    });
  };

  return (
    <Stack gap="md">
      <NumberInput
        label="Slideshow Interval (seconds)"
        min={3}
        max={120}
        value={interval}
        onChange={(value) => onConfigChange({ interval: Number(value) || 10 })}
      />
      <Select
        label="Transition Effect"
        data={[
          { value: 'fade', label: 'Fade' },
          { value: 'slide', label: 'Slide' },
          { value: 'none', label: 'None' },
        ]}
        value={transition}
        onChange={(value) => onConfigChange({ transition: (value as PhotoConfig['transition']) || 'fade' })}
      />
      <Group justify="space-between">
        <Text size="sm">Show Caption</Text>
        <Switch
          checked={showCaption}
          onChange={(e) => onConfigChange({ showCaption: e.currentTarget.checked })}
        />
      </Group>
      
      <Text size="sm" fw={500} mt="sm">Photos</Text>
      <Stack gap="xs">
        {photos.map((photo, index) => (
          <Group key={index} gap="xs">
            <TextInput
              style={{ flex: 1 }}
              value={photo.url}
              readOnly
              size="xs"
            />
            <ActionIcon 
              color="red" 
              variant="subtle" 
              onClick={() => removePhoto(index)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>
      
      <Stack gap="xs">
        <TextInput
          placeholder="Photo URL"
          value={newUrl}
          onChange={(e) => setNewUrl(e.currentTarget.value)}
          size="sm"
        />
        <TextInput
          placeholder="Caption (optional)"
          value={newCaption}
          onChange={(e) => setNewCaption(e.currentTarget.value)}
          size="sm"
        />
        <Button 
          leftSection={<IconPlus size={16} />}
          onClick={addPhoto}
          disabled={!newUrl}
          size="sm"
        >
          Add Photo
        </Button>
      </Stack>
    </Stack>
  );
}

