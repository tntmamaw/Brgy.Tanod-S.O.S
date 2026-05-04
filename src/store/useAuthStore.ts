import { create } from 'zustand';
import { User, ResidentProfile } from '../types';

interface AuthState {
  profile: User | null;
  residentProfile: ResidentProfile | null;
  setProfile: (profile: User | null) => void;
  setResidentProfile: (profile: ResidentProfile | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  residentProfile: null,
  setProfile: (profile) => set({ profile }),
  setResidentProfile: (residentProfile) => set({ residentProfile }),
  isLoading: true,
  setIsLoading: (isLoading) => set({ isLoading }),
}));
