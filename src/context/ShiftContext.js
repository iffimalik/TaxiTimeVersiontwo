import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

export const ShiftContext = createContext();

export const ShiftProvider = ({ children }) => {
  const [shiftStarted, setShiftStarted] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedTarrif, setSelectedTarrif] = useState(null);
  const [shiftStartTime, setShiftStartTime] = useState(null);
  const [shiftCloseTime, setShiftCloseTime] = useState(null);
  const [logginDriverId , setLoginDriverId] = useState(null);
  const [driver, setDriver] = useState({});
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    const loadShiftData = async () => {
      const storedShift = await AsyncStorage.getItem('shiftStarted');
      const storedVehicle = await AsyncStorage.getItem('selectedVehicle');
      const storedStartTime = await AsyncStorage.getItem('shiftStartTime');
      const storedCloseTime = await AsyncStorage.getItem('shiftCloseTime');
      const storedDriver = await AsyncStorage.getItem('DriverData');
      const storedVehicles = await AsyncStorage.getItem('DriverVehicles');
      // console.log("storedDriverstoredDriver", storedDriver);
      if (storedDriver !== null || storedDriver !== undefined || storedDriver !== '') {  
        setDriver(JSON.parse(storedDriver));
        // console.log("🟡 Driver data loaded from AsyncStorage:", JSON.parse(storedDriver)?.driverId);
 
        setLoginDriverId( JSON.parse(storedDriver)?.driverId || 0);
      } 
       
      if (storedVehicles) setVehicles(JSON.parse(storedVehicles)); 
      if (storedShift === 'true' && storedVehicle && storedStartTime) {
        setShiftStarted(true);
        setSelectedVehicle(JSON.parse(storedVehicle));
        setShiftStartTime(new Date(storedStartTime));
      }
 
      if (storedCloseTime) setShiftCloseTime(new Date(storedCloseTime));
   
    };

    loadShiftData();
  }, []);

  const startShift = async (vehicle , selectedtariff) => {
   const now = moment();
    console.log("now", now.format()); // ISO format
    setShiftStarted(true);
    setSelectedVehicle(vehicle);
    setSelectedTarrif(selectedtariff);
    console.log("now", now);
    setShiftStartTime(now.toISOString());
    setShiftCloseTime(null);
  

    await AsyncStorage.setItem('shiftStarted', 'true');
    await AsyncStorage.setItem('selectedVehicle', JSON.stringify(vehicle));
    await AsyncStorage.setItem('shiftStartTime', now.toISOString());
    await AsyncStorage.removeItem('shiftCloseTime');
  };

  const endShift = async () => {
    const now = new Date();
    setShiftStarted(false);
    setSelectedVehicle(null);
    setShiftStartTime(null);
    setShiftCloseTime(now);

    await AsyncStorage.removeItem('shiftStarted');
    await AsyncStorage.removeItem('selectedVehicle');
    await AsyncStorage.removeItem('shiftStartTime');
    await AsyncStorage.setItem('shiftCloseTime', now.toISOString());
  };


  const updateDriver = async (driverData) => {
    // console.log('🟡 Updating driver data in ShiftContext:', driverData);
    setDriver(driverData);
    await AsyncStorage.setItem('DriverData', JSON.stringify(driverData));
  };

  const updateVehicles = async (vehicleList) => {
    setVehicles(vehicleList);
    await AsyncStorage.setItem('DriverVehicles', JSON.stringify(vehicleList));
  };

  return (
    <ShiftContext.Provider
      value={{
        shiftStarted,
        selectedVehicle,
        shiftStartTime,
        shiftCloseTime,
        driver,
        logginDriverId,
        vehicles,
        startShift,
        endShift,
        setDriver: updateDriver,
        setVehicles: updateVehicles,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};
