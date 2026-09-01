import { createContext, useContext, type ReactNode } from 'react';
import type { AlarmDefinition } from '@homeslate/schema';

interface AlarmsContextValue {
  provided: boolean;
  alarms: AlarmDefinition[];
  onAlarmsChange?: (alarms: AlarmDefinition[]) => void;
  readOnly: boolean;
}

const AlarmsContext = createContext<AlarmsContextValue>({
  provided: false,
  alarms: [],
  readOnly: true,
});

export function AlarmsProvider({
  alarms,
  onAlarmsChange,
  readOnly = false,
  children,
}: {
  alarms: AlarmDefinition[];
  onAlarmsChange?: (alarms: AlarmDefinition[]) => void;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <AlarmsContext.Provider
      value={{ provided: true, alarms, onAlarmsChange, readOnly: readOnly || !onAlarmsChange }}
    >
      {children}
    </AlarmsContext.Provider>
  );
}

export function useAlarms(): AlarmsContextValue {
  return useContext(AlarmsContext);
}
