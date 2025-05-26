// store/jobStore.js
import { create } from 'zustand';

const useJobStore = create((set) => ({
  currentJob: null,
  jobStatus: 'pending', // or: accepted, on_the_way, arrived, started, completed

  setCurrentJob: (job) => set({ currentJob: job }),
  setJobStatus: (status) => set({ jobStatus: status }),
  clearJob: () => set({ currentJob: null, jobStatus: 'pending' }),
  updateCurrentJob: (updates) =>
  set(state => ({
    currentJob: state.currentJob
      ? { ...state.currentJob, ...updates }
      : null,
  })),

}));

export default useJobStore;
