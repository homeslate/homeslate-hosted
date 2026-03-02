# Development Guidelines

## Widget Configuration Persistence

### Problem
Widget-specific settings (like `transparentBackground`) were only saved to localStorage but not persisted to the database. When the app synced with the server via `setDisplays`, it would overwrite local widget configs with remote data that didn't include these new settings.

### Solution
All widget configuration changes must be saved to the database via the `/api/config` endpoint, not just localStorage.

### Implementation Pattern

1. **Add to WidgetConfig interface**: Each widget should define its config type extending `WidgetConfig`:
   ```typescript
   export interface ClockConfig extends WidgetConfig {
     showSeconds: boolean;
     transparentBackground: boolean;  // Add new settings here
   }
   ```

2. **Add to registry defaultConfig**: Every widget registry entry must include default values:
   ```typescript
   defaultConfig: {
     showSeconds: true,
     transparentBackground: false,  // Include all config keys
   },
   ```

3. **Handle in WidgetWrapper**: The WidgetWrapper adds display settings (like transparentBackground) to the modal, but individual widgets must handle their own internal styling:
   ```typescript
   // In widget component
   const { transparentBackground } = widget.config;
   
   // Apply conditional class or style
   <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
   ```

4. **Auto-save via ViewEditorPage**: The `ViewEditorPage` subscribes to Zustand store changes and automatically saves to the database when layouts change. This already works - no additional code needed.

5. **Merge local config on sync**: The `setDisplays` function in `dashboardStore.ts` merges local widget configs with remote data to preserve settings during sync:
   ```typescript
   const mergedLayouts = layouts.map((layout, idx) => {
     const existingLayout = existing?.layouts?.[idx];
     return {
       ...layout,
       widgets: layout.widgets.map((widget) => {
         const existingWidget = existingLayout?.widgets.find((w) => w.id === widget.id);
         return {
           ...widget,
           config: { ...widget.config, ...existingWidget.config },
         };
       }),
     };
   });
   ```

### Testing Checklist
When adding a new widget setting:
- [ ] Setting can be toggled in the widget settings modal
- [ ] Setting persists after page refresh
- [ ] Setting is visible when loading the page on a different browser/device (proves it's saved to DB)
- [ ] Widget properly responds to the setting (e.g., removes background when transparent)
