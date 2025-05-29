// store/jobStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useJobStore = create(
  persist(
    (set) => ({
      currentJob: null,
      jobStatus: 'pending',

      setCurrentJob: (job) =>
        set({
          currentJob: {
            ...job,
            coordinateHistory: [], // initialize with empty array
          },
        }),

      setJobStatus: (status) => set({ jobStatus: status }),

      clearJob: () =>
        set({
          currentJob: null,
          jobStatus: 'pending',
        }),

      updateCurrentJob: (updates) =>
        set((state) => ({
          currentJob: state.currentJob
            ? { ...state.currentJob, ...updates }
            : null,
        })),

      addCoordinateToHistory: (coord) =>
        set((state) => {
          if (!state.currentJob) return {};
          const newCoord = {
            ...coord,
            timestamp: new Date().toISOString(),
          };
          const updatedHistory = [
            ...(state.currentJob.coordinateHistory || []),
            newCoord,
          ];
          return {
            currentJob: {
              ...state.currentJob,
              coordinateHistory: updatedHistory,
            },
          };
        }),
    }),
    {
      name: 'job-storage',
      getStorage: () => AsyncStorage,
    }
  )
);

export default useJobStore;
