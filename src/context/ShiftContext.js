import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ShiftContext = createContext();

export const ShiftProvider = ({ children }) => {
  const [shiftStarted, setShiftStarted] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [shiftStartTime, setShiftStartTime] = useState(null);
  const [shiftCloseTime, setShiftCloseTime] = useState(null);

  useEffect(() => {
    const loadShiftData = async () => {
      const storedShift = await AsyncStorage.getItem('shiftStarted');
      const storedVehicle = await AsyncStorage.getItem('selectedVehicle');
      const storedStartTime = await AsyncStorage.getItem('shiftStartTime');
      const storedCloseTime = await AsyncStorage.getItem('shiftCloseTime');

      if (storedShift === 'true' && storedVehicle && storedStartTime) {
        setShiftStarted(true);
        setSelectedVehicle(JSON.parse(storedVehicle));
        setShiftStartTime(new Date(storedStartTime));
      }

      if (storedCloseTime) {
        setShiftCloseTime(new Date(storedCloseTime));
      }
    };
    loadShiftData();
  }, []);

  const startShift = async (vehicle) => {
    const now = new Date();
    setShiftStarted(true);
    setSelectedVehicle(vehicle);
    setShiftStartTime(now);
    setShiftCloseTime(null); // clear previous close time if any

    await AsyncStorage.setItem('shiftStarted', 'true');
    await AsyncStorage.setItem('selectedVehicle', JSON.stringify(vehicle));
    await AsyncStorage.setItem('shiftStartTime', now.toISOString());
    await AsyncStorage.removeItem('shiftCloseTime');
  };

  const endShift = async () => {
    const now = new Date();
    setShiftStarted(false);
    setSelectedVehicle(null);
    setShiftCloseTime(now);
    setShiftStartTime(null); // optional: clear start time after closing

    await AsyncStorage.removeItem('shiftStarted');
    await AsyncStorage.removeItem('selectedVehicle');
    await AsyncStorage.removeItem('shiftStartTime');
    await AsyncStorage.setItem('shiftCloseTime', now.toISOString());
  };

  return (
    <ShiftContext.Provider
      value={{
        shiftStarted,
        selectedVehicle,
        shiftStartTime,
        shiftCloseTime,
        startShift,
        endShift,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};
