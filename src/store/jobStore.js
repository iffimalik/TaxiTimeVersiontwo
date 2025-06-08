import { create } from 'zustand';
import React, {  useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import database from '@react-native-firebase/database';
import NetInfo from '@react-native-community/netinfo';
import { navigate } from '../navigation/navigationService';
import { getDriverData } from '../utils/common';
import { ShiftContext } from '../context/ShiftContext';



const useJobStore = create((set, get) => ({
  currentJob: null,
  jobStatus: 'pending',
  isOnline: true,

  initializeJobFromFirebase: async () => {
    try {
      // console.log("calling firewbase");
      const snapshot = await database().ref('jobs').once('value');
      const jobs = snapshot.val();
      if (!jobs) return;
 
      const validJob = Object.values(jobs).find(
        (job) =>
          ['pending',  'accepted'  , 'rejected', 'on_the_way', 'arrived_ready' ,  'arrived', 'started' , 'completed' , 'finished','cancelled'].includes(job.status)
      );

      if (validJob) {
        set({ currentJob: validJob, jobStatus: validJob.status });
        // console.log('✅ Job initialized from Firebase:', validJob);
      }
    } catch (error) {
      console.error('❌ Failed to initialize job from Firebase:', error);
    }
  },

  setIsOnline: async (status) => {
    set({ isOnline: status });

    if (status) {
      // Push offline job to Firebase
      const offlineJob = await AsyncStorage.getItem('offlineJob');
      if (offlineJob) {
        const parsed = JSON.parse(offlineJob);
        await database().ref(`jobs/${parsed.id}`).set(parsed);
        await AsyncStorage.removeItem('offlineJob');
        set({ currentJob: parsed, jobStatus: parsed.status });
        // console.log('✅ Flushed offline job to Firebase on reconnect');
      }

      // Always sync latest from Firebase
      await get().initializeJobFromFirebase();
    }
  },

  setCurrentJob: async (job) => {
    const fullJob = { ...job, coordinateHistory: job.coordinateHistory || [] };
    set({ currentJob: fullJob, jobStatus: job.status || 'pending' });

    if (get().isOnline) {
      await database().ref(`jobs/${job.id}`).set(fullJob);
    } else {
      await AsyncStorage.setItem('offlineJob', JSON.stringify(fullJob));
    }
  },

  setJobStatus: async (status) => {
    const job = get().currentJob;
    if (!job) return;

    const updated = { ...job, status };
    set({ currentJob: updated, jobStatus: status });

    if (get().isOnline) {
      await database().ref(`jobs/${job.id}`).set(updated);
    } else {
      await AsyncStorage.setItem('offlineJob', JSON.stringify(updated));
    }
  },

  clearJob: async () => {
    const jobId = get().currentJob?.id;
  

    await AsyncStorage.removeItem('offlineJob');
    set({ currentJob: null, jobStatus: 'pending' });

    if (get().isOnline && jobId) {
      await database().ref(`jobs/${jobId}`).set(null);
    }
 
  },

  updateCurrentJob: async (updates) => {
    const job = get().currentJob;
    if (!job) return;

    const updated = { ...job, ...updates };
    set({ currentJob: updated });

    if (get().isOnline) {
      await database().ref(`jobs/${updated.id}`).set(updated);
    } else {
      await AsyncStorage.setItem('offlineJob', JSON.stringify(updated));
    }
  },

  addCoordinateToHistory: async (coord) => {
    const job = get().currentJob;
    if (!job) return;

    const updated = {
      ...job,
      coordinateHistory: [...(job.coordinateHistory || []), {
        ...coord,
        timestamp: new Date().toISOString(),
      }],
    };

    set({ currentJob: updated });
      // console.log('Adding coordinate to history:', get().isOnline);
    if (get().isOnline) {
      await database().ref(`jobs/${updated.id}`).set(updated);
    } else {
      await AsyncStorage.setItem('offlineJob', JSON.stringify(updated));
    }
  },
  
}));

export default useJobStore;
