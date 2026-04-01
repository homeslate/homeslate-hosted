# Homeslate

A customizable home display platform built with React, Vite, and Mantine. Create beautiful dashboard layouts with drag-and-drop widgets for any screen around your home.

## Features

- **Widget Framework**: Extensible widget system with easy registration
- **Drag & Drop Layout**: Rearrange widgets with intuitive drag-and-drop
- **Resizable Widgets**: Resize widgets from any edge or corner
- **Multiple Layouts**: Create and switch between different dashboard layouts
- **Persistent Storage**: Layouts are automatically saved to local storage
- **Real-time Data**: Weather, stocks, news, and calendar integrations

## Built-in Widgets

| Widget | Description | Data Source |
|--------|-------------|-------------|
| **Clock** | Digital clock with timezone support | Local |
| **Calendar** | Events from any iCal feed | iCal URL (Google, Outlook, Apple) |
| **Google Calendar** | Full Google Calendar integration | Google OAuth |
| **Weather** | Current conditions & 7-day forecast | Open-Meteo (free, no API key) |
| **Photos** | Rotating slideshow | Photo URLs |
| **News** | RSS feed aggregator | Any RSS feed |
| **Stocks** | Real-time stock prices | Finnhub (free tier) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## Database Environments (Neon + Drizzle)

This project uses `DATABASE_URL` at runtime/migration time, so you can map each environment to a different Neon branch.

- Local development: Neon `dev` branch URL in `.env.local` as `DATABASE_URL`
- Netlify Production: Neon `prod` branch URL as `DATABASE_URL`
- Netlify Deploy Previews (optional): Neon staging/dev URL as `DATABASE_URL`

### Migration scripts

```bash
# Uses current DATABASE_URL (.env.local for local dev)
npm run db:migrate:dev

# Uses DATABASE_URL_PROD (loaded from environment or .env.local)
npm run db:migrate:prod
```

### Promote flow (dev -> prod)

1. Develop and test against Neon `dev` branch.
2. Generate migrations: `npm run db:generate`.
3. Apply to dev: `npm run db:migrate:dev`.
4. Deploy app code.
5. Apply the same migrations to prod with:
   `DATABASE_URL_PROD="postgres://..." npm run db:migrate:prod`.

Notes:
- Prefer `db:migrate` over `db:push` for production.
- Keep prod credentials in Netlify environment variables, not in committed files.

## Widget Setup Guides

### Weather Widget
No setup required! Uses Open-Meteo's free API. Just search for your location.

### Calendar Widget (iCal)
Works with any calendar that provides an iCal/ICS URL:
1. **Google Calendar**: Settings → "Secret address in iCal format"
2. **Outlook**: Share → Get a link → ICS
3. **Apple iCloud**: Share Calendar → Public Calendar

### Google Calendar Widget (OAuth)
For full Google Calendar access with multiple calendars:
📖 **[Setup Guide](docs/GOOGLE_CALENDAR_SETUP.md)**

### News Widget
Select from popular RSS feeds or add your own. No API key needed.

### Stocks Widget
Requires a free Finnhub API key:
1. Sign up at [finnhub.io](https://finnhub.io)
2. Copy your API key
3. Paste in widget settings

## Usage

1. **Start the app** - The dashboard will load with an empty layout
2. **Click "Edit Layout"** - Enter edit mode to customize your display
3. **Add Widgets** - Use the panel on the right to add widgets
4. **Drag & Resize** - Drag widgets to reposition, drag edges to resize
5. **Configure Widgets** - Click the gear icon on any widget to customize settings
6. **Click "Done"** - Exit edit mode to use your display

## Creating Custom Widgets

To create a new widget:

1. Create a widget component in `src/widgets/`:

```tsx
import { WidgetProps, WidgetConfig } from '../types/widget';

export interface MyConfig extends WidgetConfig {
  mySetting: string;
}

export function MyWidget({ widget }: WidgetProps<MyConfig>) {
  return <div>{widget.config.mySetting}</div>;
}

export function MyWidgetSettings({ widget, onConfigChange }: WidgetProps<MyConfig>) {
  return (
    <input
      value={widget.config.mySetting}
      onChange={(e) => onConfigChange({ mySetting: e.target.value })}
    />
  );
}
```

2. Register the widget in `src/widgets/registry.ts`:

```tsx
import { MyWidget, MyWidgetSettings, MyConfig } from './MyWidget';
import { IconStar } from '@tabler/icons-react';

const myEntry: WidgetRegistryEntry<MyConfig> = {
  type: 'my-widget',
  name: 'My Widget',
  description: 'A custom widget',
  icon: IconStar,
  component: MyWidget,
  settingsComponent: MyWidgetSettings,
  defaultConfig: {
    mySetting: 'default value',
  },
  defaultLayout: {
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
  },
};
widgetRegistry.set('my-widget', myEntry);
```

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Mantine 7** - UI component library
- **React Grid Layout** - Drag-and-drop grid system
- **Zustand** - State management
- **Day.js** - Date manipulation

## Project Structure

```
src/
├── components/        # UI components
│   ├── Dashboard.tsx  # Main grid layout
│   ├── Header.tsx     # App header
│   ├── WidgetWrapper.tsx
│   └── AddWidgetPanel.tsx
├── widgets/           # Widget components
│   ├── registry.ts    # Widget registration
│   ├── ClockWidget.tsx
│   ├── CalendarWidget.tsx
│   ├── GoogleCalendarWidget.tsx
│   ├── PhotoWidget.tsx
│   ├── WeatherWidget.tsx
│   ├── NewsWidget.tsx
│   └── StocksWidget.tsx
├── services/          # API integrations
│   ├── weather.ts
│   ├── calendar.ts
│   ├── googleCalendar.ts
│   ├── news.ts
│   └── stocks.ts
├── hooks/             # React hooks
├── store/             # State management
│   └── dashboardStore.ts
├── types/             # TypeScript types
│   └── widget.ts
├── App.tsx
└── main.tsx
docs/
└── GOOGLE_CALENDAR_SETUP.md  # Google OAuth setup guide
```

## API Usage

| Service | Free Tier | Rate Limits |
|---------|-----------|-------------|
| Open-Meteo (Weather) | ✅ Unlimited | 10,000/day |
| Finnhub (Stocks) | ✅ Free tier | 60/minute |
| RSS Feeds (News) | ✅ Free | Varies |
| Google Calendar | ✅ Free | 1M queries/day |

## Deployment

For a dedicated display:
1. Build the app: `npm run build`
2. Deploy to any static hosting (Vercel, Netlify, GitHub Pages)
3. Open on your display device (tablet, old laptop, Raspberry Pi)
4. Use browser kiosk mode for fullscreen

## License

MIT
