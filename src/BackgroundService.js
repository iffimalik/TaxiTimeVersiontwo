import BackgroundService from 'react-native-background-actions';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
 
import  useJobStore  from './store/jobStore';

const currentJob = useJobStore.getState().currentJob;

const sleep = time => new Promise(resolve => setTimeout(resolve, time));
import Geolocation from 'react-native-geolocation-service';
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

const veryIntensiveTask = async (taskDataArguments) => {
  const { delay } = taskDataArguments;
  let count = 0;

  while (BackgroundService.isRunning()) {
    count++;
    console.log(`Running task iteration ${count}`);
    
    try {
      if (count == 5) {
              const position = await getCurrentLocation();
           const { latitude, longitude } = position.coords;
        console.log(`GPS [${count}]:`, latitude, longitude);
         }
   
       } catch (error) {
          console.log(`GPS error [${count}]:`, error.message);
        }
      const jobStore = useJobStore.getState();
      const currentJob = jobStore.currentJob;

 
    if (currentJob && !currentJob.jobOpened) {
      try {
        // await Linking.openURL('yourapp://jobstep');
        console.log(`Opened JobStep screen for job: ${currentJob.id}`);

        // ✅ update jobOpened inside currentJob
        jobStore.setCurrentJob({ ...currentJob, jobOpened: true });
      } catch (err) {
        console.log('Error opening job step screen:', err.message);
      }
    }


    await sleep(delay);
  }
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

  // For iOS or other platforms, return true by default
  return true;
};

export const startService = async () => {
  try {
    const isRunning = await BackgroundService.isRunning();
    if (isRunning) {
      console.log('Background service is already running.');
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
      parameters: { delay: 2000 }, // 2 seconds between updates
      foregroundServiceTypes: ['location'],
      notificationChannelId: 'RN_BACKGROUND_ACTIONS_CHANNEL', // must match Kotlin
      color: 'red',
    });

    console.log('Background service started successfully.');




  } catch (e) {
    Alert.alert('Error', e.message);
  }
};

export const stopService = async () => {
  await BackgroundService.stop();
};
