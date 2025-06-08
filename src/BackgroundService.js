import BackgroundService from 'react-native-background-actions';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import useJobStore from './store/jobStore';
import useLocationStore from './store/locationStore';
import { navigationRef, navigate } from './navigation/navigationService'; // adjust path if needed
 import haversine from 'haversine-distance';
import auth from '@react-native-firebase/auth';
 
import database, { update } from '@react-native-firebase/database';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showConfirmationToast,
} from './utils/showToast'; // Adjust path as needed
import AsyncStorage from '@react-native-async-storage/async-storage';
import {   useContext } from 'react';
import { TarrifContext } from './context/TarrifContext';

const sleep = time => new Promise(resolve => setTimeout(resolve, time));

const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      {
        enableHighAccuracy: true,
         timeout: 3000,
        maximumAge: 2000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  });
};
 export  const getCurrentLocationforce = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 2000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  });
};
 
 
const veryIntensiveTask = async (taskDataArguments) => {
  const { delay } = taskDataArguments;
  let count = 0;

  while (BackgroundService.isRunning()) {
    count++;

    // Get current position
    let latitude = null;
    let longitude = null;
    let heading = 0; // Initialize heading
    try {
      const position = await getCurrentLocation();
      latitude = position?.coords?.latitude ?? null;
      longitude = position?.coords?.longitude ?? null;
      heading = position?.coords?.heading ?? 0; // heading in degrees

      useLocationStore.getState().setLocation({ latitude, longitude });
      useLocationStore.getState().setHeading(heading); // Update heading in the store
      const userId = auth().currentUser?.uid;
      // console.log(`Current Position [${count}]:`, latitude, longitude , userId);
      if (userId && latitude !== null && longitude !== null) {
        // Update location in Firebase
        const companyId = await AsyncStorage.getItem('CompanyId') || '1';
        if (companyId) {
          await database()
            .ref(`companies/${companyId}/onlineAgents/${userId}/currentLocation`)
            .update({
              latitude: latitude,
              longitude: longitude,
              timestamp: database.ServerValue.TIMESTAMP,
            });
          // console.log('Driver location updated in Firebase:', latitude, longitude);
        } else {
          console.warn('Company ID is not available, cannot update location in Firebase.');
        }
      }
    } catch (error) {
      console.log(`GPS error [${count}]:`, error.message);
    }

    const {
      currentJob,
      jobStatus,
      updateCurrentJob,
      clearJob,
      addCoordinateToHistory
    } = useJobStore.getState();
    // console.log(    currentJob);
    // console.log(`Current Job: ${currentJob?.id ?? 'No job'}`);
    const statusOrder = [
      'pending', 'rejected', 'accepted', 'on_the_way',
      'arrived_ready', 'arrived', 'started',
      'completed', 'finished','cancelled'
    ];
    if (!currentJob ) {
      await sleep(delay);
     
    } else if(currentJob ) {
      
   

    const currentStatusIndex = statusOrder.indexOf(jobStatus);
    const startedIndex = statusOrder.indexOf('started');
    const currentRouteName = navigationRef.getCurrentRoute()?.name;

      // console.log("currentRouteName", currentRouteName);
      //  console.log(startedIndex , currentStatusIndex);
        if (currentStatusIndex !== -1 && currentStatusIndex < startedIndex) {
          try {
       
        // console.log(`Navigating to AcceptJobScreen for job: ${currentJob.id}`);
        updateCurrentJob({ ...currentJob, jobOpened: true });
        // navigate('AcceptJobScreen');

      } catch (err) {
        console.log('Error opening AcceptJobScreen:', err.message);
      }
    }

    // If job is started
    else if (jobStatus === 'started') {
       
          // console.log('Job is started');
          if (!jobStatus.jobOpened) { 
             updateCurrentJob({ ...currentJob, jobOpened: true });
          }
         if (!currentJob.driver_job_start_time) {
              updateCurrentJob({ driver_job_start_time:  new Date().toISOString()});
          }
          if (latitude && longitude) {
            updateCurrentJob({ currentLocation: { latitude, longitude } });
            updateCurrentJob({ heading: useLocationStore.getState().heading });
            // console.log(`Current Location: ${latitude}, ${longitude}`);
            addCoordinateToHistory({ latitude, longitude });
          }
        calculateJobPricing(currentJob);
         updateDistanceTravelled();
     
   }
   else if (jobStatus === 'finished' || jobStatus === 'cancelled') {
          clearJob();
       
    }

    }

    await sleep(delay);
  }
};
const calculateJobPricing = (job) => {
  const tariff = job?.selectedTarrif || {};
  const history = job?.coordinateHistory || [];

  const startTime = new Date(job?.driver_job_start_time);
  const now = new Date();
  const elapsedSeconds = (now - startTime) / 1000;

  let totalDistance = 0;
  for (let i = 1; i < history.length; i++) {
    totalDistance += haversine(history[i - 1], history[i]);
  }

  // Convert tariff values to numbers (in case they're strings)
  const startingPrice = parseFloat(tariff.startingPrice || 0);
  const startingDistance = parseFloat(tariff.startingDistance || 0); // in meters
  const distanceRate = parseFloat(tariff.distanceRate || 0);         // per meter
  const timeRate = parseFloat(tariff.timeRate || 0);                 // per second
  const waitingRate = parseFloat(tariff.waitingRate || 0);           // per second

  let price = startingPrice;

  if (history.length >= 2) {
    const extraDistance = Math.max(totalDistance - startingDistance, 0);
    price += extraDistance * distanceRate;
    price += elapsedSeconds * timeRate;
    // If you want to use waiting time logic separately, handle it here using `waitingRate`
  }

  // Update job state
  useJobStore.getState().updateCurrentJob({
    earningsSoFar: price.toFixed(2),
  });
};
const calculateJobPricing1 = (job) => {

 
  // const tariff = job?.selectedTarrif || {};

//   {
//     "unit": "metric",
//     "waitingRate": "0.0060",
//     "updatedAt": "2025-06-05T19:49:08.682Z",
//     "startingPrice": "6.00",
//     "timeRate": "0.0120",
//     "createdAt": "2025-06-05T19:49:08.682Z",
//     "distanceRate": "0.0250",
//     "startingDistance": 800,
//     "zoneId": "6e0dc279-c791-4ab7-9d59-827c48e36ea3",
//     "name": "Weekend Special",
//     "id": "618a4df5-1c91-4287-8068-f7d6f83eb8b5"
// }
 
  const tariff = {
    StartPrice: 4.0,
    ForFirst: 1000,
    DistanceRate: 4.0,
    PerDistance: 1000,
    TimeRate: 1.0,
    PerTime: 60,
    WaitingRate: 1.0,
    Perwating: 60,
  };

  const history = job?.coordinateHistory || [];
  const startTime = new Date(job?.driver_job_start_time);
  const now = new Date();
  const elapsedSeconds = (now - startTime) / 1000;

  let totalDistance = 0;
  for (let i = 1; i < history.length; i++) {
    totalDistance += haversine(history[i - 1], history[i]);
  }

  let price = tariff.StartPrice;

  if (history.length >= 2) {
    const extraDistance = Math.max(totalDistance - tariff.ForFirst, 0);
    price += (extraDistance / tariff.PerDistance) * tariff.DistanceRate;
    price += (elapsedSeconds / tariff.PerTime) * tariff.TimeRate;
  }

  useJobStore.getState().updateCurrentJob({
    earningsSoFar: price.toFixed(2)
  });
};

const updateDistanceTravelled = () => {
  const updatedJob = useJobStore.getState().currentJob;
  const history = updatedJob.coordinateHistory || [];

  let distance = 0;
  for (let i = 1; i < history.length; i++) {
    distance += haversineDistance(history[i - 1], history[i]);
  }

  useJobStore.getState().updateCurrentJob({
    distanceTravelled: distance
  });
};

 const haversineDistance = (coord1, coord2) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const R = 6371e3; // Earth's radius in meters
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);
  const deltaLat = toRad(coord2.latitude - coord1.latitude);
  const deltaLon = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};

const checkPermissions = async () => {
  if (Platform.OS === 'android') {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      'android.permission.FOREGROUND_SERVICE',
    ];
    if (Platform.Version >= 33) {
      permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    const allGranted = permissions.every(
      permission => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
    );

    return allGranted;
  }

  return true;
};

export const startService = async () => {
  const locationStore = useLocationStore.getState();

  try {
    const isRunning = await BackgroundService.isRunning();
    if (isRunning) {
      // console.log('Background service is already running.');
      locationStore.setBackgroundServiceRunning(true);
      return;
    }

    const hasPermission = await checkPermissions();
    if (!hasPermission) throw new Error('Permissions denied');

    await BackgroundService.start(veryIntensiveTask, {
      taskName: 'MyTask',
      taskTitle: 'Service Running',
      taskDesc: 'Tracking location in background',
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      linkingURI: 'your.app.scheme://',
      parameters: { delay: 1500 },
      foregroundServiceTypes: ['location'],
      notificationChannelId: 'RN_BACKGROUND_ACTIONS_CHANNEL',
      color: 'red',
    });

    locationStore.setBackgroundServiceRunning(true);
    // console.log('Background service started successfully.');

  } catch (e) {
    locationStore.setBackgroundServiceRunning(false);
    // Alert.alert('Error', e.message);
    showErrorToast('Error starting service', e.message);
    
  }
};

export const stopService = async () => {
  const locationStore = useLocationStore.getState();

  await BackgroundService.stop();
  locationStore.setBackgroundServiceRunning(false);

  database()
    .ref(`companies/${await AsyncStorage.getItem('CompanyId') || '1'}/onlineAgents/${auth().currentUser?.uid}/`)
    .remove()
    .then(() => {
      // console.log('Location removed from Firebase');
    })
    .catch(error => {
      console.error('Error removing location from Firebase:', error);
    });
  // console.log('Background service stopped successfully.');
};
export const isServiceRunning = async () => {
  return await BackgroundService.isRunning();
};