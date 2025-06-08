import React, { createContext, useContext, useEffect } from 'react';
import useJobStore from '../store/jobStore'; // adjust path if needed

export const JobContext = createContext();

export const JobProvider = ({ children }) => {
  const {
    currentJob,
    jobStatus,
    isOnline,
    initializeJobFromFirebase,
    setIsOnline,
    setCurrentJob,
    setJobStatus,
    clearJob,
    updateCurrentJob,
    addCoordinateToHistory,
  } = useJobStore();

  // Optional: auto-initialize job on mount
  useEffect(() => {
    initializeJobFromFirebase();
  }, [initializeJobFromFirebase]);

  return (
    <JobContext.Provider
      value={{
        currentJob,
        jobStatus,
        isOnline,
        initializeJobFromFirebase,
        setIsOnline,
        setCurrentJob,
        setJobStatus,
        clearJob,
        updateCurrentJob,
        addCoordinateToHistory,
      }}
    >
      {children}
    </JobContext.Provider>
  );
};

export const useJob = () => useContext(JobContext);
