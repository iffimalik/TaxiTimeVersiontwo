// store/locationStore.js
import { create } from 'zustand';

const useLocationStore = create((set, get) => ({
  latitude: null,
  longitude: null,
  isBackgroundServiceRunning: false,
  history: [],

  setLocation: ({ latitude, longitude }) => {
    const newEntry = { latitude, longitude, timestamp: new Date().toISOString() };
    const currentHistory = get().history || [];
    set({
      latitude,
      longitude,
      history: [...currentHistory, newEntry],
    });
  },

  clearHistory: () => set({ history: [] }),

  setBackgroundServiceRunning: (isRunning) =>
    set({ isBackgroundServiceRunning: isRunning }),
}));

export default useLocationStore;
