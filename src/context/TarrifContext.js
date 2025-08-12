// context/TarrifContext.js
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api'; // Assuming your API service path
import { ENDPOINTS, TarrifZone } from '../utils/constants'; // Assuming your API endpoints defined here
import useJobStore from '../store/jobStore';
 
export const TarrifContext = createContext();

export const TarrifProvider = ({ children }) => {
  const [isTarrifSelected, setIsTarrifSelected] = useState(false);
  const [isNeedtoRefresh, setIsNeedtoRefresh] = useState(false);
  const [selectedTarrif, setSelectedTarrif] = useState(null);
  const [availableTariffs, setAvailableTariffs] = useState([]); // Tariffs for the detected zone
  const [detectedZone, setDetectedZone] = useState(null); // Full detected zone object
  const { currentJob, setCurrentJob, setJobStatus, setIsOnline } = useJobStore();

  useEffect(() => {
    const loadTarrifData = async () => {
      try {
        const storedTarrif = await AsyncStorage.getItem('selectedTarrif');
        if (storedTarrif) {
          setSelectedTarrif(JSON.parse(storedTarrif));
          setIsTarrifSelected(true);
        } else {
          setIsTarrifSelected(false);
        }

           
        const isNeedtoRefresh = await AsyncStorage.getItem('isNeedtoRefresh');
        // console.log("isNeedtoRefreshisNeedtoRefreshisNeedtoRefreshisNeedtoRefresh", isNeedtoRefresh);
        if (isNeedtoRefresh != null && isNeedtoRefresh != undefined) {
          if (isNeedtoRefresh == 'true') {
            setIsNeedtoRefresh(true);
            AsyncStorage.setItem('isNeedtoRefresh' ,JSON.stringify(true)); // Ensure it's stored as a boolean
          } else {
            setIsNeedtoRefresh(false);
            AsyncStorage.setItem('isNeedtoRefresh' ,JSON.stringify(false)); // Ensure it's stored as a boolean
          }
        } else {
          setIsNeedtoRefresh(false); // Default to false if not set
        }
        
          
        const storedTariffs = await AsyncStorage.getItem('AvailableTariffs');
        if (storedTariffs) {
          setAvailableTariffs(JSON.parse(storedTariffs));
        }

        const storedDetectedZone = await AsyncStorage.getItem('DetectedZone');
        if (storedDetectedZone) {
          setDetectedZone(JSON.parse(storedDetectedZone));
        }  

      } catch (error) {
        console.error('Failed to load tariff data from AsyncStorage', error);
      }
    };
    loadTarrifData();
  }, []);

  /**
   * Fetches zone and associated tariffs based on provided coordinates.
   * Updates `detectedZone` and `availableTariffs` states.
   * Persists these to AsyncStorage.
   *
   * @param {number} lat - Latitude of the driver's current location.
   * @param {number} lng - Longitude of the driver's current location.
   * @param {string} token - Driver's authentication token for API authorization.
   * @returns {object|null} The detected zone object if found, otherwise null.
   */
  const fetchZoneAndTariffs = async (lat, lng, token) => {
    try {
      // Clear previous zone/tariffs while fetching new ones
      setDetectedZone(null);
      setAvailableTariffs([]);
      setIsTarrifSelected(false); // Reset tariff selection when fetching new zone data
      setSelectedTarrif(null); // Also clear selected tariff

      const response = await api.post(TarrifZone.DetectZoneAndTariff, {
        lat: lat,
        lng: lng,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // The response structure you provided is:
      // { "message": "...", "zone": { ...zoneData... } }
      // So, we access `response.data.zone`
      // console.log("responseresponse", response);
      if (response && response.zone && Object.keys(response.zone).length > 0) {
        const zoneData = response.zone; // This correctly gets the 'zone' object
        setDetectedZone(zoneData);
        if (zoneData?.tariffs && zoneData.tariffs?.length > 0) {
          setAvailableTariffs(zoneData.tariffs); 
          await AsyncStorage.setItem('AvailableTariffs', JSON.stringify(zoneData?.tariffs));
        } else {
          setAvailableTariffs([]);
          await AsyncStorage.removeItem('AvailableTariffs');
        }
        await AsyncStorage.setItem('DetectedZone', JSON.stringify(zoneData)); // Store detected zone
        return zoneData; // Return the detected zone object for use in StartShiftScreen
      } else {
        // If no zone is detected or response is malformed/empty
        setDetectedZone(null);
        setAvailableTariffs([]);
        await AsyncStorage.removeItem('AvailableTariffs');
        await AsyncStorage.removeItem('DetectedZone');
        return null;
      }
    } catch (error) {
      console.error('Error fetching zone and tariffs:', error);
      // Ensure states and storage are cleared on error
      setDetectedZone(null);
      setAvailableTariffs([]);
      await AsyncStorage.removeItem('AvailableTariffs');
      await AsyncStorage.removeItem('DetectedZone');
      throw error; // Re-throw to be handled by the caller (StartShiftScreen)
    }
  };

  const selectTarrif = async (tariff) => {
    setIsTarrifSelected(true);
    setSelectedTarrif(tariff);
    try {
      await AsyncStorage.setItem('selectedTarrif', JSON.stringify(tariff));
    } catch (error) {
      console.error('Failed to save selected tariff to AsyncStorage', error);
    }
  };
  const updateSelectedTarrif = async (tariffData) => {
    // Always update the locally selected tariff state for immediate UI reflection
    setSelectedTarrif(tariffData);

    // Check if there is an active job (currentJob is not null and has an ID)
    if (currentJob && currentJob.id) {
        const now = new Date().toISOString(); // Get the current timestamp

        // Retrieve the existing tariff change history from the current job,
        // or initialize an empty array if it doesn't exist yet.
        const currentTariffHistory = currentJob.tariff_change_history || [];

        // Create a new record for this specific tariff change
        const newTariffChangeRecord = {
            timestamp: now,
            newTariff: tariffData, // Store the new tariff data
            // You might optionally want to store the previous tariff as well:
            // previousTariff: currentJob.selectedTarrif || null,
        };

        // Append the new record to the history array
        const updatedTariffHistory = [...currentTariffHistory, newTariffChangeRecord];

        // Update the current job in your Zustand store
        // This ensures the current job's active tariff is updated,
        // and importantly, the historical record is also saved in the store.
        useJobStore.getState().updateCurrentJob({
            selectedTarrif: tariffData, // The currently active tariff for the job
            tariff_change_history: updatedTariffHistory, // The complete history of changes
        }, 'updateSelectedTarrif');

        // IMPORTANT: Backend Synchronization
        // If your application relies on a backend to persist job data (which it likely does
        // given `changeRideStatus`), you MUST ensure that this `tariff_change_history`
        // is also sent to your backend.
        //
        // Options:
        // 1. If `changeRideStatus` or another job update API function takes the full `currentJob`
        //    object as a payload, then simply calling `updateCurrentJob` will prepare the data.
        //    You would then call that API function at a suitable time (e.g., job completion,
        //    or even right here if you need real-time persistence of tariff changes).
        //    Example (if you want to persist immediately):
        //    await changeRideStatus(
        //        currentJob.status, // or a specific "tariff_updated" status if applicable
        //        currentJob.id,
        //        driver.driverId,
        //        driver.token,
        //        { ...currentJob, selectedTarrif: tariffData, tariff_change_history: updatedTariffHistory }
        //    );
        //    ^ This would require driver and currentJob being in scope.
        //
        // 2. Implement a dedicated API call to update job details (specifically tariff history).
        //    Example:
        //    await yourApi.updateJobTariffHistory(currentJob.id, updatedTariffHistory);
        //    This approach keeps concerns separated.
    }

    // Update the flag indicating if a tariff is selected
    setIsTarrifSelected(!!tariffData); // Set to true if tariffData exists, false if null/undefined

    // Persist the *currently selected* tariff to AsyncStorage for app reloads.
    // This is typically for the UI's initial state after app restart, not the history.
    await AsyncStorage.setItem('selectedTarrif', JSON.stringify(tariffData));
};

  // const updateSelectedTarrif = async (tariffData) => {
  //   setSelectedTarrif(tariffData);
  //      if (currentJob !== null) {
     

  //      useJobStore.getState().updateCurrentJob({
  //       selectedTarrif: tariffData
  //     });
  //   }
  //   setIsTarrifSelected(!!tariffData); // Set true if data exists, false if null
  //   await AsyncStorage.setItem('selectedTarrif', JSON.stringify(tariffData));
  // };

  const updateAvailableTariffs = async (tariffList) => {
    setAvailableTariffs(tariffList);
    await AsyncStorage.setItem('AvailableTariffs', JSON.stringify(tariffList));
  };

  const clearSelectedTarrif = async () => {
     
 
 
    setIsNeedtoRefresh(false);
       
    AsyncStorage.removeItem('isNeedtoRefresh');
    
  };

  const updateisNeedtoRefresh = async (value) => {
    // console.log("updateisNeedtoRefreshupdateisNeedtoRefreshupdateisNeedtoRefresh", value);
    setIsNeedtoRefresh(value);
    await AsyncStorage.setItem('isNeedtoRefresh', JSON.stringify(value));
  };
  
  return (
    <TarrifContext.Provider
      value={{
        isNeedtoRefresh,
        isTarrifSelected,
        setIsNeedtoRefresh,
        selectedTarrif,
        availableTariffs,
        detectedZone, // Expose detectedZone for use in TarrifSelectionScreen
        fetchZoneAndTariffs, // Expose the function to trigger API call
        selectTarrif,
        setSelectedTarrif,
        clearSelectedTarrif,
        updateSelectedTarrif,
        updateAvailableTariffs,
        updateisNeedtoRefresh
      }}
    >
      {children}
    </TarrifContext.Provider>
  );
};
