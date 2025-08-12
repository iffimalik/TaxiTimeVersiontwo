import BackgroundService from 'react-native-background-actions';
 
import Geolocation from 'react-native-geolocation-service';
import { showErrorToast, showSuccessToast, showInfoToast } from './utils/showToast';
import { mainBackgroundTask } from './utils/services/movementTracker';
import useLocationStore from './store/locationStore';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';


export const getCurrentLocationforce = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 0,
        forceRequestLocation: true,
        showLocationDialog: false,
      }
    );
  });
};
const serviceOptions = {
  taskName: 'DriverLocationAndJobMonitor',
  taskTitle: 'Driver Service Active',
  taskDesc: 'Tracking your location and job status',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' },
  notificationChannelId: 'DRIVER_APP_CHANNEL',
  color: '#007bff',
  delay: 1000
};
 const checkPermissions = async () => {
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
     )
      return false;
    }
  }
  return true; // For iOS
  
  };
export const startService = async () => {
  try {
    if (await BackgroundService.isRunning()) {
      showInfoToast('Service Already Running', 'Background service is already active.');
      return false;
    }
    
    const hasPermission = await checkPermissions();
    if (!hasPermission) {
      showErrorToast('Permissions Required', 'Location permissions are essential');
      return false;
    }
    
    await BackgroundService.start(mainBackgroundTask, serviceOptions);
    useLocationStore.getState().setBackgroundServiceRunning(true);
    showSuccessToast('Service Started', 'Background service activated.');
    return true;
  } catch (error) {
    useLocationStore.getState().setBackgroundServiceRunning(false);
    console.error('Service start failed:', error);
    showErrorToast('Service Error', error.message || 'Failed to start service.');
    return false;
  }
};
 
export const stopService = async () => {
  try {
    if (!await BackgroundService.isRunning()) {
      showInfoToast('Service Not Running', 'Background service is not active.');
      return false;
    }

    await BackgroundService.stop();
    
    // Clean up Firebase presence
    const userId = auth().currentUser?.uid;
    if (userId) {
      const companyId = await AsyncStorage.getItem('CompanyId') || 'defaultCompany';
      await database().ref(`companies/${companyId}/onlineAgents/${userId}`).remove();
    }
    
    useLocationStore.getState().setBackgroundServiceRunning(false);
    showInfoToast('Service Stopped', 'Background service deactivated.');
    return true;
  } catch (error) {
    console.error('Service stop failed:', error);
    showErrorToast('Service Error', error.message || 'Failed to stop service.');
    return false;
  }
};

export const isServiceRunning = async () => {
  return BackgroundService.isRunning();
};