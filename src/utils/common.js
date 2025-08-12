// common.js (or utils/shiftActions.js)
import api from "../services/api";
import { ENDPOINTS, JOBENDPOINT } from "./constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showErrorToast } from "./showToast";
import { PermissionsAndroid, Platform } from 'react-native';
import auth from '@react-native-firebase/auth';

// shiftStatusChange does NOT use hooks anymore\
export const shiftStatusChange = async (status, vehicleId, driverId, token, jobstatus = 'onboard') => {
  try {
    const response = await api.put(
      ENDPOINTS.DRIVER_SHIFT_CHANGE,
      { shiftActivity: status },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    if (jobstatus === 'offboard') {
      await api.delete(
        ENDPOINTS.DRIVER_VEHICLE_OFFBOARD(driverId, vehicleId),
        { driverId, vehicleId },
        {
          Authorization: `Bearer ${token}`,
        }
      );
    } else {
      await api.post(
        ENDPOINTS.DRIVER_VEHICLE_ONBOARD,
        { driverId, vehicleId },
        {
          Authorization: `Bearer ${token}`,
        }
      );
    }

    return response;
  } catch (error) {
    console.error('Error updating shift status:', error);
    showErrorToast('Error', 'Failed to update shift. Please try again.');
    return null;
  }
};


export const driverLocationChange = async (latitude, 
            longitude, 
            accuracy, 
            speed, // This speed is already in KM/H from useLocationStore
            heading, 
            // timestamp, 
            movementState ) => {
 
        if (!JSON.parse(await AsyncStorage.getItem('DriverData'))?.token) {
                
          showErrorToast('Error', 'Please Logout and Login Again');
          await auth().signOut();
          return null;
        }
  let test = 0;
 
    try {
       let response =  await api.put(
        ENDPOINTS.DRIVER_LOCATION_UPDETE,
         {latitude, 
            longitude, 
            accuracy, 
            speed, // This speed is already in KM/H from useLocationStore
            heading, 
             test,
            movementState },
        {
          Authorization: `Bearer ${JSON.parse(await AsyncStorage.getItem('DriverData'))?.token}`,
        }
   );
    }catch(error) {
      console.log("error", error.message);
    }
    
 
}

 export const changeRideStatus = async (status, jobId, driverId, token , joobject) => {
   try {
    //  console.log("status, jobId, driverId, token , joobject", status, jobId, driverId, token);
    const response = await api.put(
      JOBENDPOINT.CHANGE_RIDE_STATUS(jobId, driverId, status),
      joobject,
      {
        Authorization: `Bearer ${token}`,
      }
    );
    return null;
  } catch (error) {
    console.error('Error changing ride status:', error);
    return null;
  }
};


export const sleep = time => new Promise(resolve => setTimeout(resolve, time));

 
export const calculateHaversineDistance = (loc1, loc2) => {
  if (!loc1?.latitude || !loc1?.longitude || !loc2?.latitude || !loc2?.longitude) {
    return 0;
  }

  const R = 6371e3; // Earth radius in meters
  const φ1 = loc1.latitude * Math.PI / 180;
  const φ2 = loc2.latitude * Math.PI / 180;
  const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};


export const checkPermissions = async () => {
 if (Platform.OS === 'android') {
    try {
      // Build permissions list based on Android version
      const permissionsToRequest = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ];

      // NFC permission (note: NFC permission is actually declared in manifest, not requested at runtime)
      // permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.NFC);

      // Bluetooth permissions
      if (Platform.Version >= 31) {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      } else {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN
        );
      }

      // Notification permission (Android 13+)
      if (Platform.Version >= 33) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }

      // Check which permissions we actually need to request
      const permissionsStatus = await Promise.all(
        permissionsToRequest.map(p => PermissionsAndroid.check(p))
      );
      
      const needsRequest = permissionsToRequest.filter((_, i) => 
        permissionsStatus[i] !== PermissionsAndroid.RESULTS.GRANTED
      );

      if (needsRequest.length === 0) {
        return true; // All permissions already granted
      }

      // Request only needed permissions
      const granted = await PermissionsAndroid.requestMultiple(needsRequest);
      
      const allGranted = needsRequest.every(
        p => granted[p] === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        const deniedPermissions = needsRequest.filter(
          p => granted[p] !== PermissionsAndroid.RESULTS.GRANTED
        );
        console.warn('Denied permissions:', deniedPermissions);
        showErrorToast(
          'Permissions Required', 
          `Please grant ${deniedPermissions.join(', ')} in Settings for full functionality`
        );
      }
      return allGranted;

    } catch (err) {
      console.error('Permission error details:', err);
      showErrorToast(
        'Permission Error', 
        'Failed to check/request permissions. Please check app settings.'
      );
      return false;
    }
  }
  return true; // For iOS
  
  };