// context/TarrifContext.js
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api'; // Assuming your API service path
import { ENDPOINTS, TarrifZone } from '../utils/constants'; // Assuming your API endpoints defined here

export const TarrifContext = createContext();

export const TarrifProvider = ({ children }) => {
  const [isTarrifSelected, setIsTarrifSelected] = useState(false);
  const [isNeedtoRefresh, setIsNeedtoRefresh] = useState(false);
  const [selectedTarrif, setSelectedTarrif] = useState(null);
  const [availableTariffs, setAvailableTariffs] = useState([]); // Tariffs for the detected zone
  const [detectedZone, setDetectedZone] = useState(null); // Full detected zone object

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
        if (isNeedtoRefresh) {
          setIsNeedtoRefresh(isNeedtoRefresh);
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
    setSelectedTarrif(tariffData);
    setIsTarrifSelected(!!tariffData); // Set true if data exists, false if null
    await AsyncStorage.setItem('selectedTarrif', JSON.stringify(tariffData));
  };

  const updateAvailableTariffs = async (tariffList) => {
    setAvailableTariffs(tariffList);
    await AsyncStorage.setItem('AvailableTariffs', JSON.stringify(tariffList));
  };

  const clearSelectedTarrif = async () => {
    
    setIsNeedtoRefresh(true);
    
    AsyncStorage.removeItem('isNeedtoRefresh', true);
    
  };

  const updateisNeedtoRefresh = async (value) => {
    setIsNeedtoRefresh(value);
    await AsyncStorage.setItem('isNeedtoRefresh', value);
  };
  
  return (
    <TarrifContext.Provider
      value={{
        isNeedtoRefresh,
        isTarrifSelected,
        selectedTarrif,
        availableTariffs,
        detectedZone, // Expose detectedZone for use in TarrifSelectionScreen
        fetchZoneAndTariffs, // Expose the function to trigger API call
        selectTarrif,
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
