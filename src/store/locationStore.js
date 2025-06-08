// store/locationStore.js
import { create } from 'zustand';

const useLocationStore = create((set, get) => ({
  latitude: null,
  longitude: null,
    heading: 0, // <- NEW: device heading

  isBackgroundServiceRunning: false,
  history: [],

  // setLocation: ({ latitude, longitude }) => {
  //   const newEntry = { latitude, longitude, timestamp: new Date().toISOString() };
  //   const currentHistory = get().history || [];
  //   set({
  //     latitude,
  //     longitude,
  //     history: [...currentHistory, newEntry],
  //   });
  // },
setLocation: ({ latitude, longitude, heading }) => {
    const newEntry = {
      latitude,
      longitude,
      heading: heading ?? get().heading, // fallback to last known heading
      timestamp: new Date().toISOString(),
    };

    const currentHistory = get().history || [];
    set({
      latitude,
      longitude,
      heading,
      history: [...currentHistory, newEntry],
    });
  },
   setHeading: (newHeading) => {
    set({ heading: newHeading });
},
  clearHistory: () => set({ history: [] }),

  setBackgroundServiceRunning: (isRunning) =>
    set({ isBackgroundServiceRunning: isRunning }),
}));

export default useLocationStore;
