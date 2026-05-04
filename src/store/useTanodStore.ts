import { create } from 'zustand';
import { PatrolLocation, Shift } from '../types';

interface TanodState {
  patrols: PatrolLocation[];
  shifts: Shift[];
  setPatrols: (patrols: PatrolLocation[]) => void;
  setShifts: (shifts: Shift[]) => void;
  updateShiftStatus: (shiftId: string, status: Shift['status']) => void;
}

export const useTanodStore = create<TanodState>((set) => ({
  patrols: [],
  shifts: [],
  setPatrols: (patrols) => set({ patrols }),
  setShifts: (shifts) => set({ shifts }),
  updateShiftStatus: (shiftId, status) => set((state) => ({
    shifts: state.shifts.map((s) => s.id === shiftId ? { ...s, status } : s)
  })),
}));
