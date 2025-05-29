import BackgroundService from 'react-native-background-actions';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import useJobStore from './store/jobStore';
import useLocationStore from './store/locationStore';
import { navigationRef, navigate } from './navigation/navigationService'; // adjust path if needed
 

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

//   const locationStore = useLocationStore.getState();
//   const jobStore = useJobStore.getState();

//   while (BackgroundService.isRunning()) {
//     count++;
    
    
//     try {
//       const position = await getCurrentLocation();
//       const { latitude, longitude } = position.coords;
      

//       // Save to location store
//       // locationStore.setLocation(latitude, longitude);
//        useLocationStore.getState().setLocation({ latitude, longitude });
//     } catch (error) {
//       console.log(`GPS error [${count}]:`, error.message);
//     }

//     // const currentJob = useJobStore.getState().currentJob;
//     // console.log(`Current Job: ${currentJob ? JSON.stringify(currentJob) : 'No job'}`);
//     // if (currentJob && !currentJob.jobOpened) {
//     //   try {
//     //     console.log(`Opened JobStep screen for job: ${currentJob.id}`);
//     //     jobStore.setCurrentJob({ ...currentJob, jobOpened: true });
//     //      navigate('AcceptJobScreen');
//     //   } catch (err) {
//     //     console.log('Error opening job step screen:', err.message);
//     //   }
//     // }
//        const { currentJob, jobStatus } = useJobStore.getState();

//        console.log(`Current Job: ${currentJob ? JSON.stringify(currentJob) : 'No job'}`);

//       if (currentJob) {
//         if (jobStatus === 'arrived') {
//           console.log('Navigating to JobTrackingScreen because status is arrived');
//           navigate('JobTrackingScreen');
//         } else if (!currentJob.jobOpened) {
//           try {
//             console.log(`Opened JobStep screen for job: ${currentJob.id}`);
//             useJobStore.getState().setCurrentJob({ ...currentJob, jobOpened: true });
//             navigate('AcceptJobScreen');
//           } catch (err) {
//             console.log('Error opening job step screen:', err.message);
//           }
//         }
//       }

//     await sleep(delay);
//   }
// };
 
const veryIntensiveTask = async (taskDataArguments) => {
  const { delay } = taskDataArguments;
  let count = 0;

  while (BackgroundService.isRunning()) {
    count++;
    let latitudex = null;
    let longitudex = null;
    try {
      const position = await getCurrentLocation();
      const { latitude, longitude } = position.coords;
      latitudex = latitude;
      longitudex = longitude;
      useLocationStore.getState().setLocation({ latitude, longitude });
    } catch (error) {
      console.log(`GPS error [${count}]:`, error.message);
    }

    const { currentJob, jobStatus } = useJobStore.getState();

    console.log(`Current Job: ${currentJob ? JSON.stringify(currentJob.coordinateHistory.length) : 'No job'}`);
 
    if (currentJob) {
      const statusOrder = [
        'pending',       // 0
        'accepted',      // 1
        'on_the_way',    // 2
        'arrived_ready', // 3
        'arrived',       // 4
        'started',       // 5
        'completed'      // 6
      ];

      const currentStatusIndex = statusOrder.indexOf(jobStatus);
      const startedIndex = statusOrder.indexOf('started');

      if (currentStatusIndex !== -1 && currentStatusIndex < startedIndex) {
        try {
          console.log(`Navigating to AcceptJobScreen for job: ${currentJob.id}`);
          useJobStore.getState().setCurrentJob({
            ...currentJob,
            jobOpened: true,
          });
          navigate('AcceptJobScreen');
        } catch (err) {
          console.log('Error opening AcceptJobScreen:', err.message);
        }
      } else {
        if (jobStatus === 'started' ) {
          const currentRouteName = navigationRef.getCurrentRoute()?.name;
          //  && !currentJob.navigatedToTracking
          console.log({ latitude: latitudex, longitude: latitudex, longitudex });
            useJobStore.getState().addCoordinateToHistory({latitude: latitudex, longitude: latitudex, longitudex});
          if (currentRouteName !== 'JobTrackingScreen') {
            console.log('Navigating to JobTrackingScreen because status is arrived');
            navigate('JobTrackingScreen', { job: currentJob });
          } else {
            console.log('Already on JobTrackingScreen, not navigating again');
          }
        }
      }
    }
    // if (currentJob) {
    //   // Handle navigation to JobTrackingScreen
     
    //   const statusOrder = [
    //     'pending',       // 0
    //     'accepted',      // 1
    //     'on_the_way',    // 2
    //     'arrived_ready', // 3
    //     'arrived',       // 4
    //     'started',       // 5
    //     'completed'      // 6
    //   ];

    // const currentStatusIndex = statusOrder.indexOf(jobStatus);
    // const startedIndex = statusOrder.indexOf('started');
    //     // console.log("started" , currentJob.status)
    // if (currentStatusIndex !== -1 && currentStatusIndex < startedIndex) {
    //   // status is before 'started' (including arrived_ready and arrived)
    //   try {
    //     console.log(`Navigating to AcceptJobScreen for job: ${currentJob.id}`);
    //     useJobStore.getState().setCurrentJob({
    //       ...currentJob,
    //       jobOpened: true,
    //     });
    //     navigate('AcceptJobScreen');
    //   } catch (err) {
    //     console.log('Error opening AcceptJobScreen:', err.message);
    //   }
    // } else {

    //    if (jobStatus === 'arrived' && !currentJob.navigatedToTracking) {
    //     console.log('Navigating to JobTrackingScreen because status is arrived');
    //     navigate('JobTrackingScreen' , { job: currentJob });

      
    //   }

       
    // }

    // }

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

  return true;
};

export const startService = async () => {
  const locationStore = useLocationStore.getState();

  try {
    const isRunning = await BackgroundService.isRunning();
    if (isRunning) {
      console.log('Background service is already running.');
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
      parameters: { delay: 2000 },
      foregroundServiceTypes: ['location'],
      notificationChannelId: 'RN_BACKGROUND_ACTIONS_CHANNEL',
      color: 'red',
    });

    locationStore.setBackgroundServiceRunning(true);
    console.log('Background service started successfully.');

  } catch (e) {
    locationStore.setBackgroundServiceRunning(false);
    Alert.alert('Error', e.message);
  }
};

export const stopService = async () => {
  const locationStore = useLocationStore.getState();

  await BackgroundService.stop();
  locationStore.setBackgroundServiceRunning(false);
};
export const isServiceRunning = async () => {
  return await BackgroundService.isRunning();
};