import { create } from 'zustand';
import { Alert, AlertStatus } from '../types';

interface IncidentState {
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  updateAlertStatus: (alertId: string, status: AlertStatus) => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (alertId: string) => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts.filter(a => a.id !== alert.id)]
  })),
  removeAlert: (alertId) => set((state) => ({
    alerts: state.alerts.filter(a => a.id !== alertId)
  })),
  updateAlertStatus: (alertId, status) => set((state) => ({
    alerts: state.alerts.map((a) => a.id === alertId ? { ...a, status } : a)
  })),
}));
