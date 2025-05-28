import { create } from 'zustand';

const useLocationStore = create((set) => ({
  currentLocation: null,
  locationUpdates: [],
  isTracking: false,
  
  setCurrentLocation: (location) => set({ currentLocation: location }),
  addLocationUpdate: (location) => 
    set(state => ({ locationUpdates: [...state.locationUpdates, location] })),
  clearLocations: () => set({ locationUpdates: [] }),
  setIsTracking: (isTracking) => set({ isTracking }),
}));

export default useLocationStore;