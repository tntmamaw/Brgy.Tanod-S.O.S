import { create } from 'zustand';
import { AuditLogEntry, AuditLogArchive } from '../types/auditLog';

interface LogState {
  logs: AuditLogEntry[];
  archives: AuditLogArchive[];
  addLog: (entry: AuditLogEntry) => void;
  setLogs: (logs: AuditLogEntry[]) => void;
  setArchives: (archives: AuditLogArchive[]) => void;
  clearActiveLogs: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  archives: [],
  addLog: (entry) => set((state) => ({ logs: [...state.logs, entry] })),
  setLogs: (logs) => set({ logs }),
  setArchives: (archives) => set({ archives }),
  clearActiveLogs: () => set({ logs: [] }),
}));
