import { create } from 'zustand';
import { Alert, AlertStatus } from '../types';

interface IncidentState {
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  updateAlertStatus: (alertId: string, status: AlertStatus) => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  updateAlertStatus: (alertId, status) => set((state) => ({
    alerts: state.alerts.map((a) => a.id === alertId ? { ...a, status } : a)
  })),
}));
