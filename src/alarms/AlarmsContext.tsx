import { createContext, useContext, type ReactNode } from 'react';
import type { AlarmDefinition } from './types';

interface AlarmsContextValue {
  alarms: AlarmDefinition[];
  onAlarmsChange?: (alarms: AlarmDefinition[]) => void;
  readOnly: boolean;
}

const AlarmsContext = createContext<AlarmsContextValue>({
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
      value={{ alarms, onAlarmsChange, readOnly: readOnly || !onAlarmsChange }}
    >
      {children}
    </AlarmsContext.Provider>
  );
}

export function useAlarms(): AlarmsContextValue {
  return useContext(AlarmsContext);
}
