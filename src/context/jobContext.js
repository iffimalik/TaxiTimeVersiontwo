import React, { createContext, useContext, useEffect  } from 'react';
import useJobStore from '../store/jobStore'; // adjust path if needed
import api from '../services/api';
import { REALTIMEJOB } from '../utils/constants';
import { TarrifContext } from '../context/TarrifContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { set } from 'date-fns';
import { useDriverWebSocket } from '../utils/services/socketService';

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

  const { setSelectedTarrif, availableTariffs, selectedTarrif } = useContext(TarrifContext);
//   const { connectionStatus, sendWebSocketMessage } = useDriverWebSocket(
//     // This callback will be triggered when new messages are received from the WebSocket
//     ({ type, job, jobId }) => {
//       console.log(`[DriverMapScreen] Received WS message: Type=${type}, JobID=${jobId || job?.id}`);
//       // Here you would typically update your app's state (e.g., job store, UI notifications)
//       // based on the incoming message.
//     }
//   );
// sendWebSocketMessage({
//     type: 'getActiveJob',
//     driverId: 'driver123', // Replace with actual driver ID
//   });
  const getDriver = async () => {
  try {
    const data = await AsyncStorage.getItem('DriverData');
    // console.log('🚗 Driver data retrieved from AsyncStorage:', data);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('❌ Error getting driver data from AsyncStorage:', error);
    return null;
  }
};
 const CreateJobObject = async (response) => {
    try {
      if (!response) return null;
  
 
      if (response?.jobData) {
        
        console.log("response.jobData", response.jobData);
        // If jobData is already in the response, use it directly
        return JSON.parse(response.jobData);
      }
   
      const {
        id,
        pickupLocation,
        dropoffLocation,
        createdAt,
        pickupTime,
        dropoffTime,
        fare,
        earningsSoFar,
        status,
        distance,
        duration,
        rider,
        notes,
        tarrif,
        paymentStatus,
        paymentMethod,
        RideType,
        tariffId,
        passengerCount,
            bagCount,
         wheelchairCount,
         wheelchairAccessNeeded,
        towingOption,
        jobStatusLog,
        driverId,
        jobData
      } = response;
   
      const storedTariffs = await AsyncStorage.getItem('AvailableTariffs');
      // console.log(" AsyncStorage.getItem('selectedTarrif');",await AsyncStorage.getItem('selectedTarrif'));
      // console.log("storedTariffs", storedTariffs);
      let selectedTarrif = JSON.parse(await AsyncStorage.getItem('selectedTarrif'));
      if (tariffId && tariffId !== null && tariffId !== undefined) {
        setSelectedTarrif(JSON.parse(storedTariffs)?.find(t => t.id === tariffId));
        console.log("tarrif secltion");
      } else if (selectedTarrif?.id) {
          setSelectedTarrif(JSON.parse(storedTariffs)?.find(t => t.id === selectedTarrif.id));
      }
       



      const jobObject = {
        id: id || '',
        pickupLocation: pickupLocation?.address || 'N/A',
        dropoffLocation: dropoffLocation?.address || 'N/A',
        pickupLat: pickupLocation?.latitude || 0,
        pickupLng: pickupLocation?.longitude || 0,
        dropoffLat: dropoffLocation?.latitude || 0,
        dropoffLng: dropoffLocation?.longitude || 0,
        destination: dropoffLocation?.address || 'N/A',
        CreatedAt: createdAt || new Date().toISOString(),
        pickupTime: pickupTime || '',
        dropoffTime: dropoffTime || '',
        earningsSoFar: earningsSoFar || '0.00',
        estimatedFare: fare ?? '0.00',
        status: status || 'pending',
        distance: distance ?? '0.0',
        estimatedDuration: duration || 'N/A',
        riderName: rider?.name || 'Guest User',
        riderPhone: rider?.phoneNumber || '+974 123123123',
        notes: notes || '',
        vehicle: {
          model: selectedTarrif?.name ? `${selectedTarrif.name} Tier` : 'Standard Vehicle',
          color: 'White',
        },
        destinationLat: dropoffLocation?.latitude || 0,
        destinationLng: dropoffLocation?.longitude || 0,
        coordinateHistory: [],
        driver_job_end_time: null,
        tariff: tariffId || selectedTarrif?.id, // Default to a standard tariff
        selectedTarrif: selectedTarrif,
        driver_job_start_time: new Date().toISOString(),
        fair : earningsSoFar || '0.00',
        paymentStatus,
        paymentMethod,
        RideType,
        tariffId:   tariffId || selectedTarrif?.id, // Default to a standard tariff
        passengerCount,
        bagCount,
        wheelchairCount,
        wheelchairAccessNeeded,
        towingOption,
        jobStatusLog,
        driverId: driverId || '', // Assuming driver ID is available in context
      
      };
   
      console.log('🚗 JOB Object:', jobObject);
      return jobObject;
    } catch (error) {
      console.error('❌ Error creating job objectsssss:', error);
      return null;
    }
  };
  const fetchJobsFromApi = async () => {
    const driver = await getDriver();
    console.log("driver", driver);
    if (!driver) {
      console.warn('No driver data found. Cannot initialize job.');
      return [];
    }

    try {
      const response = await api.get(
        REALTIMEJOB.GET_DRIVER_ACTIVE_RIDE(driver.driverId),
        { Authorization: `Bearer ${driver.token}` }
      );
      console.log("response1111111", response);
      let jobdata;
      if (response?.id) {
        jobdata = await CreateJobObject(response);
        try {
          setCurrentJob(jobdata);
          setJobStatus(jobdata.status || 'pending');
          console.log(jobStatus);
          console.log('🚗 Job initialized:', currentJob);
          }catch (error) {
            console.error('Error setting current job:', error);
          }
      }
      console.log("jobdata", jobdata);
      // if (response?.length === 0) return [];
      
      // if (response[0].jobData) {
      //   return [JSON.parse(response[0].jobData)];
      // }
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch jobs from API:', error);
      throw error;
    }
  };
  // Optional: auto-initialize job on mount
  useEffect(() => {
    

    if (currentJob) {
      console.log('Current job already exists, skipping initialization.');
      return;
    } else {
      console.log('No current job found, initializing from Firebase...');
      // Call the initialize function to fetch job data
      // This is useful if you want to ensure the job is set up when the app starts
      // or when the component mounts.
      // You can also call this function from other components as needed.
      // For example, you might want to call it when the user logs in or when the
      // app regains focus after being in the background.
      //  initializeJobFromFirebase();
      fetchJobsFromApi();
    }


    // initializeJobFromFirebase();
  }, []); 

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
