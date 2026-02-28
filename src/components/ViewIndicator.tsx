import { useDashboardStore } from '../store/dashboardStore';
import classes from './ViewIndicator.module.css';

export function ViewIndicator() {
  const { layouts, activeLayoutId, isEditing, setActiveLayout } = useDashboardStore();

  // Only show when there are multiple views and we're not editing
  if (layouts.length <= 1 || isEditing) return null;

  return (
    <div className={classes.indicator}>
      {layouts.map((layout) => (
        <button
          key={layout.id}
          className={`${classes.dot} ${layout.id === activeLayoutId ? classes.dotActive : ''}`}
          onClick={() => setActiveLayout(layout.id)}
          title={layout.name}
          aria-label={`Switch to ${layout.name}`}
        />
      ))}
    </div>
  );
}
