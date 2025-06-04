import BackgroundService from 'react-native-background-actions';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import useJobStore from './store/jobStore';
import useLocationStore from './store/locationStore';
import { navigationRef, navigate } from './navigation/navigationService'; // adjust path if needed
 import haversine from 'haversine-distance';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showConfirmationToast,
} from './utils/showToast'; // Adjust path as needed
import AsyncStorage from '@react-native-async-storage/async-storage';

const sleep = time => new Promise(resolve => setTimeout(resolve, time));

const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  });
};
 
 
// const veryIntensiveTask = async (taskDataArguments) => {
//   const { delay } = taskDataArguments;
//   let count = 0;

//   while (BackgroundService.isRunning()) {
//     count++;
//     let latitudex = null;
//     let longitudex = null;

//     try {
//       const position = await getCurrentLocation();
//       const { latitude, longitude } = position.coords;
//       latitudex = latitude;
//       longitudex = longitude;
//       useLocationStore.getState().setLocation({ latitude, longitude });
//     } catch (error) {
//       console.log(`GPS error [${count}]:`, error.message);
//     }

//     const { currentJob, jobStatus, updateCurrentJob  , clearJob , addCoordinateToHistory } = useJobStore.getState();
//     console.log(`Current Job: ${currentJob ? currentJob.id : 'No job'}`);

//     if (currentJob) {
//       const statusOrder = [
//         'pending', 'accepted', 'on_the_way',
//         'arrived_ready', 'arrived', 'started', 'completed','finished'
//       ];

//       const currentStatusIndex = statusOrder.indexOf(jobStatus);
//       const startedIndex = statusOrder.indexOf('started');
       
//       if (currentStatusIndex !== -1 && currentStatusIndex < startedIndex) {
//         try {
//           console.log(`Navigating to AcceptJobScreen for job: ${currentJob.id}`);
//           useJobStore.getState().setCurrentJob({
//             ...currentJob,
//             jobOpened: true,
//           });
//           navigate('AcceptJobScreen');
//         } catch (err) {
//           console.log('Error opening AcceptJobScreen:', err.message);
//         }
//       } else {
//          console.log('Current Job Status:', jobStatus);
//          console.log('Current Status Index:', currentStatusIndex);
//          console.log('Started Index:', startedIndex);
//         if (jobStatus == "started") {
//           const currentRouteName = navigationRef.getCurrentRoute()?.name;

//           console.log({ latitude: latitudex, longitude: longitudex });
//            addCoordinateToHistory({ latitude: latitudex, longitude: longitudex });

//           let tariff = {
//             StartPrice: 4.0,
//             ForFirst: 1000,
//             DistanceRate: 4.0,
//             PerDistance: 1000,
//             TimeRate: 1.0,
//             PerTime: 60,
//             WaitingRate: 1.0,
//             Perwating: 60,
//           };
//           let coordinateHistory = currentJob.coordinateHistory || [];
//           const driverJobStartTime = currentJob.driver_job_start_time;
//           let price = 0;

//           if (coordinateHistory.length < 2) {
          
//             price = tariff?.StartPrice?.toFixed(2) || '0.00';
//           } else {
//             let totalDistanceMeters = 0;

//             for (let i = 1; i < coordinateHistory.length; i++) {
//               const prev = coordinateHistory[i - 1];
//               const curr = coordinateHistory[i];

//               totalDistanceMeters += haversine(
//                 { lat: prev.latitude, lon: prev.longitude },
//                 { lat: curr.latitude, lon: curr.longitude }
//               );
//             }

//             const jobStartTime = new Date(driverJobStartTime);
//             const now = new Date();
//             const elapsedTimeSeconds = (now - jobStartTime) / 1000;

//             price = tariff.StartPrice;

//             const additionalDistance = Math.max(totalDistanceMeters - tariff.ForFirst, 0);
//             const distanceUnits = additionalDistance / tariff.PerDistance;
//             price += distanceUnits * tariff.DistanceRate;

//             const timeUnits = elapsedTimeSeconds / tariff.PerTime;
//             price += timeUnits * tariff.TimeRate;
//           }

//           useJobStore.getState().updateCurrentJob({
//             earningsSoFar: price.toFixed(2)
//           });

//           const updatedJob = useJobStore.getState().currentJob;
//           const history = updatedJob.coordinateHistory || [];
//           let totalDistance = 0;

//           for (let i = 1; i < history.length; i++) {
//             totalDistance += haversineDistance(history[i - 1], history[i]);
//           }

//           useJobStore.getState().updateCurrentJob({
//             distanceTravelled: totalDistance // in meters
//           });

//           if (currentRouteName !== 'JobTrackingScreen') {
//             console.log('Navigating to JobTrackingScreen because status is started');
//             navigate('JobTrackingScreen', { job: updatedJob });
//           } else {
//             console.log('Already on JobTrackingScreen, not navigating again');
//           }
//         } else {
//           if (jobStatus == 'completed') {
//             const currentRouteName = navigationRef.getCurrentRoute()?.name;
//             // alert("assad");
//             if (currentRouteName !== 'CompleteJobScreen') {
//               console.log('Job is completed. Navigating to CompleteJobScreen...');
//               navigate('CompleteJobScreen', { job: currentJob });
//             } else {
//               console.log('Already on CompleteJobScreen');
//             }
//           } else {
//             if (jobStatus == 'finished') {
//              clearJob();
//             }
//           }
//         }
//       }
//     }

//     await sleep(delay);
//   }
// };
const veryIntensiveTask = async (taskDataArguments) => {
  const { delay } = taskDataArguments;
  let count = 0;

  while (BackgroundService.isRunning()) {
    count++;

    // Get current position
    let latitude = null;
    let longitude = null;

    try {
      const position = await getCurrentLocation();
      latitude = position?.coords?.latitude ?? null;
      longitude = position?.coords?.longitude ?? null;
      useLocationStore.getState().setLocation({ latitude, longitude });
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
    // console.log(      JSON.stringify(currentJob));
    // console.log(`Current Job: ${currentJob?.id ?? 'No job'}`);
    const statusOrder = [
      'pending', 'rejected', 'accepted', 'on_the_way',
      'arrived_ready', 'arrived', 'started',
      'completed', 'finished','cancelled'
    ];
    if (!currentJob ) {
      await sleep(delay);
     
    } else if(currentJob && !currentJob.finished_time) {
      
   

    const currentStatusIndex = statusOrder.indexOf(jobStatus);
    const startedIndex = statusOrder.indexOf('started');
    const currentRouteName = navigationRef.getCurrentRoute()?.name;

        if (currentStatusIndex !== -1 && currentStatusIndex < startedIndex) {
      try {
        // console.log(`Navigating to AcceptJobScreen for job: ${currentJob.id}`);
        updateCurrentJob({ ...currentJob, jobOpened: true });
        navigate('AcceptJobScreen');
      } catch (err) {
        console.log('Error opening AcceptJobScreen:', err.message);
      }
    }

    // If job is started
        else if (jobStatus === 'started') {
         if (!currentJob.driver_job_start_time) {
              updateCurrentJob({ driver_job_start_time:  new Date().toISOString()});
          }
          if (latitude && longitude) {
            updateCurrentJob({ currentLocation: { latitude, longitude } });
            // console.log(`Current Location: ${latitude}, ${longitude}`);
            addCoordinateToHistory({ latitude, longitude });
          }

      calculateJobPricing(currentJob);
      updateDistanceTravelled();

      if (currentRouteName !== 'JobTrackingScreen') {
        // console.log('Navigating to JobTrackingScreen');
        navigate('JobTrackingScreen', { job: useJobStore.getState().currentJob });
      }
    }

    // If job is completed
    else if (jobStatus === 'completed') {
      if (currentRouteName !== 'CompleteJobScreen') {
        // console.log('Navigating to CompleteJobScreen');
        navigate('CompleteJobScreen', { job: currentJob });
      }
    }

    // If job is finished
    else if (jobStatus === 'finished' || jobStatus === 'cancelled') {
      clearJob();
    }

    }

    await sleep(delay);
  }
};
const calculateJobPricing = (job) => {
 
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
      parameters: { delay: 5000 },
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