import { useMemo } from 'react';
import {
  getActiveHoliday,
  getHolidayById,
} from '../holidays/registry';
import type { HolidayId } from '../holidays/registry';
import classes from './HolidayEffects.module.css';

interface HolidayEffectsProps {
  previewHolidayId?: HolidayId;
}

export function HolidayEffects({ previewHolidayId }: HolidayEffectsProps) {
  const holiday = useMemo(
    () => (previewHolidayId ? getHolidayById(previewHolidayId) : getActiveHoliday(new Date())),
    [previewHolidayId]
  );

  if (!holiday) return null;

  return (
    <div
      className={`${classes.overlay} ${classes[holiday.styleVariant]}`}
      aria-label={`${holiday.label} effects`}
      role="presentation"
    >
      <div className={classes.banner}>{holiday.bannerText}</div>
      <div className={classes.sparkles} aria-hidden="true">
        {Array.from({ length: holiday.symbolCount }, (_, idx) => (
          <span key={idx} className={classes.sparkle}>
            {holiday.symbol}
          </span>
        ))}
      </div>
    </div>
  );
}
