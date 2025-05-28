// store/locationStore.js
import { create } from 'zustand';

const useLocationStore = create((set) => ({
  latitude: null,
  longitude: null,
  isBackgroundServiceRunning: false,

setLocation: ({ latitude, longitude }) => set({ latitude, longitude }),
 
  setBackgroundServiceRunning: (isRunning) => set({ isBackgroundServiceRunning: isRunning }),
}));

export default useLocationStore;
