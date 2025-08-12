 
 
import useJobStore from '../../store/jobStore'; // Import the job Zustand store
import useLocationStore from '../../store/locationStore'; // Import the location Zustand store
import auth from '@react-native-firebase/auth'; // For Firebase authentication related checks
import database from '@react-native-firebase/database'; // For direct Firebase Realtime Database interactions
import { showErrorToast, showSuccessToast, showInfoToast } from '../../utils/showToast'; // Utility for toasts
import AsyncStorage from '@react-native-async-storage/async-storage'; // For persistent storage (driver data, etc.)
import { changeRideStatus, driverLocationChange } from '../../utils/common'; // Utility for changing ride status

// --- Configuration Constants ---
// These constants are relevant to the job processing logic.
const ACTIVE_CONFIG = {
  // Distance threshold for filtering out GPS noise when accumulating distance.
  GPS_NOISE_FILTER: 10, // meters - movement below this is considered noise.
  // Default update interval when the job is stopped or not actively tracking detailed metrics.
  STOPPED_UPDATE_INTERVAL: 3000, // milliseconds
};
 
const MS_TO_KMH_FACTOR = 3.6; // 1 m/s = 3.6 km/h
 
const msToKmh = (speedMs) => speedMs * MS_TO_KMH_FACTOR;

 
class EnhancedJobTimer {
  constructor() {
    this.startTime = null; // Timestamp when the job officially started
    this.lastUpdateTime = null; // Timestamp of the last time job metrics were updated
    this.totalWaitingSeconds = 0; // Accumulated waiting time in seconds
    this.totalDistanceMeters = 0; // Accumulated distance in meters
    this.initializedFromStore = false; // Flag to ensure one-time initialization from job data
    this.lastKnownCoordinate = null; // Last coordinate used for distance calculation within this timer
    this.logPrefix = '[JobTimer]'; // Prefix for console logs
  }
 
  initializeFromJob(job) {
    // Prevent re-initialization if already done or if no job is provided.
    if (this.initializedFromStore || !job) {
      if (this.initializedFromStore) {
        // console.log(`${this.logPrefix} Already initialized from store.`);
      }
      return;
    }

    // Set start time from job data, or null if not available.
    if (job.driver_job_start_time) {
      this.startTime = new Date(job.driver_job_start_time);
    } else {
      this.startTime = null;
    }

    // Initialize accumulated distance and waiting time from job data.
    this.totalDistanceMeters = parseFloat(job.totalAccumulatedDistanceMeters) || 0;
    this.totalWaitingSeconds = parseFloat(job.totalAccumulatedWaitingSeconds) || 0;

    // Initialize last known coordinate for distance calculation.
    if (job.lastKnownCoordinate?.latitude && job.lastKnownCoordinate?.longitude) {
      this.lastKnownCoordinate = {
        latitude: job.lastKnownCoordinate.latitude,
        longitude: job.lastKnownCoordinate.longitude,
        accuracy: job.lastKnownCoordinate.accuracy,
        timestamp: job.lastKnownCoordinate.timestamp
      };
      // console.log(`${this.logPrefix} Last known coordinate initialized from job data.`);
    } else {
      this.lastKnownCoordinate = null;
    }

    this.initializedFromStore = true; // Mark as initialized
 
  }

 
  start() {
    if (!this.startTime) {
      this.startTime = new Date();
      console.log(`${this.logPrefix} JobTimer started.`);
      // this.lastUpdateTime = new Date.now();
    }

  }
  
update(currentLocation) {
  const now = Date.now();
 

  // Initialize lastUpdateTime if missing
  if (!this.lastUpdateTime) {
    this.lastUpdateTime = now;
  }

  // Calculate time difference in **whole seconds**
  const timeDiffSeconds = Math.floor((now - this.lastUpdateTime) / 1000);

  // Defensive: if negative time diff (clock change), reset and return current stats
  if (timeDiffSeconds < 0) {
    this.lastUpdateTime = now;
    return {
      distance: this.totalDistanceMeters || 0,
      waiting: this.totalWaitingSeconds || 0,
      elapsed: ((now - (this.startTime || now)) / 1000) || 0,
      isMoving: currentLocation?.speed >= 1,
    };
  }

  let distanceMovedThisTick = 0;

  // Calculate distance only if coordinates changed
  if (
    currentLocation &&
    this.lastKnownCoordinate &&
    (currentLocation.latitude !== this.lastKnownCoordinate.latitude ||
      currentLocation.longitude !== this.lastKnownCoordinate.longitude)
  ) {
    distanceMovedThisTick = calculateHaversineDistance(this.lastKnownCoordinate, currentLocation);
  }

  // Moving if speed >= 1 (km/h)
  const isMoving = currentLocation?.speed >= 1;
 
  if (isMoving) {
    // Add distance if significant movement (filter noise)
    if (distanceMovedThisTick > ACTIVE_CONFIG.GPS_NOISE_FILTER) {
      this.totalDistanceMeters = (this.totalDistanceMeters || 0) + distanceMovedThisTick;
    }
    // Don't add waiting time if moving
  } else {
    // Add waiting time in seconds only when NOT moving
    this.totalWaitingSeconds = (this.totalWaitingSeconds || 0) + timeDiffSeconds;
  }

  // Update lastUpdateTime for next cycle
  this.lastUpdateTime = now;

  // Update lastKnownCoordinate for next distance calculation
  if (currentLocation) {
    this.lastKnownCoordinate = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      accuracy: currentLocation.accuracy,
      timestamp: currentLocation.timestamp || Date.now(),
    };
  }

  // Return results
  return {
    distance: this.totalDistanceMeters || 0,
    waiting: this.totalWaitingSeconds || 0,
    elapsed: ((now - (this.startTime || now)) / 1000) || 0,
    isMoving,
  };
}



  /**
   * Resets all job timer states, clearing accumulated distance, waiting time, and start time.
   */
  reset() {
    this.startTime = null;
    this.lastUpdateTime = null;
    this.totalWaitingSeconds = 0;
    this.totalDistanceMeters = 0;
    this.initializedFromStore = false;
    this.lastKnownCoordinate = null; // Clear last known coordinate
    // console.log(`${this.logPrefix} JobTimer reset.`);
  }
}
 
const jobTimer = new EnhancedJobTimer(); // Global instance of the timer

// --- Job Status Order Definition ---
// Defines the sequence of job statuses.
const statusOrder = [
  'pending', 'sending' , 'displayed' ,'rejected', 'accepted', 'on_the_way',
  'arrived_ready', 'arrived', 'started', 'paused',
  'completed', 'finished', 'cancelled','noShow', 'recalled'
];

// Global variable to hold the last known location when the job is paused.
let lastPausedLocation = null;

// Cached Firebase and Driver data to avoid redundant AsyncStorage reads.
// These are populated by the main background task or other authentication flows.
let cachedCompanyId = null;
let cachedDriverData = null;

/**
 * Sets up Firebase authentication listener to cache user and driver data.
 * This should ideally be called once at app startup or when the background task starts.
 * It populates `cachedCompanyId` and `cachedDriverData`.
 */
const setupFirebaseAndDriverDataCache = () => {
  // Ensure this is only run once globally if possible, or handle re-runs gracefully.
  auth().onAuthStateChanged(async (user) => {
    if (user) {
      try {
        cachedCompanyId = await AsyncStorage.getItem('CompanyId') || 'defaultCompany';
        const driverDataString = await AsyncStorage.getItem('DriverData');
        cachedDriverData = driverDataString ? JSON.parse(driverDataString) : {};
        // console.log('[JobProcessing] Firebase user and driver data cached.');
      } catch (error) {
        console.error("[JobProcessing] Error caching data from AsyncStorage on auth change:", error);
      }
    } else {
      cachedCompanyId = null;
      cachedDriverData = null;
      console.log('[JobProcessing] No Firebase user detected, clearing cache.');
    }
  });
};

// Call the setup function immediately to start listening for auth state.
setupFirebaseAndDriverDataCache();

/**
 * Processes the current job state, updates metrics, handles status transitions,
 * and uploads data to Firebase. This function is designed to be called repeatedly
 * by an external background task (e.g., `mainBackgroundTask`).
 * @param {object} currentLocation - The latest location object from `useLocationStore`.
 * @param {string} movementStateFromStore - The movement state string (e.g., 'STOPPED', 'MOVING') from `useLocationStore`.
 * @returns {object} An object containing the `nextUpdateInterval` suggested for the caller.
 */
export const processCurrentJobState = async (currentLocation, movementStateFromStore) => {
  
  const { currentJob, jobStatus, setJobStatus, updateCurrentJob, clearJob, isOnline } = useJobStore.getState();

  let date = new Date();
  //  console.log("Enterence", ACTIVE_CONFIG.STOPPED_UPDATE_INTERVAL ,  date.toISOString().slice(0, 19).replace('T', ' '));
  const currentStatusIndex = statusOrder.indexOf(jobStatus);
  
  const startedIndex = statusOrder.indexOf('started');
  const terminalStatuses = ['finished', 'cancelled','noShow', 'recalled'];

  
  if (!currentJob || terminalStatuses.includes(jobStatus) || jobStatus === 'completed') {
   
    if (currentJob && terminalStatuses.includes(jobStatus)) {
 
        clearJob(); // Clear job from store if it's a terminal state
    }
    jobTimer.reset(); // Reset timer for clean state
    lastPausedLocation = null; // Clear last paused location
    return { nextUpdateInterval: ACTIVE_CONFIG.STOPPED_UPDATE_INTERVAL , isJobActive: false }; // Return default interval
  }
 
  if (jobStatus === 'paused') {
    if (lastPausedLocation && currentLocation) {
      const distanceMovedFromPaused = calculateHaversineDistance(
        lastPausedLocation,
        currentLocation
      );

      // If driver moves significantly while paused, auto-resume job.
      if (distanceMovedFromPaused > ACTIVE_CONFIG.GPS_NOISE_FILTER) {
        if (cachedDriverData?.driverId && cachedDriverData?.token) {
          // console.log('[JobProcessing] Driver moved while paused, resuming job.');
          await changeRideStatus('started', currentJob?.id, cachedDriverData.driverId, cachedDriverData.token, currentJob);
          setJobStatus('started'); // Update Zustand store
          const resume_job_time = new Date().toISOString();
          updateCurrentJob({ resume_job_time, status: 'started' } , 'handleResumeJob'); // Update job object in store
          showSuccessToast('Job Resumed', 'Redirecting to the job.');
        } else {
          console.warn('[JobProcessing] Could not resume job: DriverData missing for changeRideStatus.');
        }
      }
    }
 
    if (currentLocation) {
      lastPausedLocation = { ...currentLocation };
    }
    jobTimer.reset();  
    return { nextUpdateInterval: ACTIVE_CONFIG.STOPPED_UPDATE_INTERVAL }; // Less frequent updates when paused
  }
 
  if (jobStatus !== 'paused') {
    lastPausedLocation = null;
  }
  
  jobTimer.initializeFromJob(currentJob); // Initialize timer from current job data (once per job lifecycle)
  jobTimer.start(); // Ensure timer is running

   
  if (currentStatusIndex !== -1 && currentStatusIndex < startedIndex) {
    if (!currentJob.jobOpened) {
      
      updateCurrentJob({ jobOpened: true } , 'setJobOpened'); // Direct update
    }
  }

  // --- Main Job Processing Logic when Job Status is 'started' ---
  let nextUpdateInterval = ACTIVE_CONFIG.STOPPED_UPDATE_INTERVAL; 

  if (currentJob.status === 'started') {
    try {
      // Record driver job start time if not already set.
      if (!currentJob.driver_job_start_time) {
        // console.log('[JobProcessing] Setting driver job start time.');
        updateCurrentJob({ driver_job_start_time: new Date().toISOString() }, 'setDriverJobStartTime'  );
      }

      // Update job timer with current location (fetched from useLocationStore externally).
      const { distance, waiting, elapsed, isMoving } = jobTimer.update(currentLocation);
      // console.log("elapsed",  waiting, elapsed);
      const updates = {
        totalAccumulatedDistanceMeters: parseFloat(distance.toFixed(2)),
        totalAccumulatedWaitingSeconds: parseFloat(waiting.toFixed(2)),
        isDriverMoving: isMoving,
 
        movementType: movementStateFromStore, 
 
      };

     
      if (currentLocation) {
        updates.currentLocation = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          speed: currentLocation.speed, // Speed is already in KM/H from useLocationStore
          heading: currentLocation.heading,
          timestamp: currentLocation.timestamp // Use timestamp from location
        };
       
        if (jobTimer.lastKnownCoordinate) {
          updates.lastKnownCoordinate = {
            latitude: jobTimer.lastKnownCoordinate.latitude,
            longitude: jobTimer.lastKnownCoordinate.longitude,
            timestamp: jobTimer.lastKnownCoordinate.timestamp,
            accuracy: jobTimer.lastKnownCoordinate.accuracy
          };
        }
      }

      
      updateCurrentJob(updates , 'processCurrentJobState'); // Update job in store
      
      
      if (currentLocation) {
          useJobStore.getState().addCoordinateToHistory({
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              accuracy: currentLocation.accuracy,
              speed: currentLocation.speed, // KM/H
              heading: currentLocation.heading
          });
      }
      
      calculateJobPricing(elapsed, distance, waiting); // Recalculate and update job pricing.
 
      switch (movementStateFromStore) {
          case 'STOPPED':
              nextUpdateInterval = useLocationStore.getState().nextUpdateInterval || ACTIVE_CONFIG.STOPPED_UPDATE_INTERVAL;
              break;
          case 'NORMAL_SPEED':
              nextUpdateInterval = useLocationStore.getState().nextUpdateInterval || 2000; // Example
              break;
          case 'LITTLE_HIGH_SPEED':
              nextUpdateInterval = useLocationStore.getState().nextUpdateInterval || 800; // Example
              break;
          case 'MORE_SPEED':
              nextUpdateInterval = useLocationStore.getState().nextUpdateInterval || 600; // Example
              break;
          case 'TOO_HIGH_SPEED':
              nextUpdateInterval = useLocationStore.getState().nextUpdateInterval || 500; // Example
              break;
          case 'MOVING': // Generic moving if detailed categories are not available
              nextUpdateInterval = useLocationStore.getState().nextUpdateInterval || 1000; // Example
              break;
          default:
              nextUpdateInterval = ACTIVE_CONFIG.STOPPED_UPDATE_INTERVAL;
      }

 
      if (isOnline && currentLocation && cachedCompanyId && cachedDriverData?.driverId) {
             //  if (speed > VEHICLE_CONFIG.NORMAL_SPEED) {
                  // console.log("speed is greater", speed);
                     await  driverLocationChange( currentLocation.latitude,
                       currentLocation.longitude,
                           currentLocation.accuracy || 999, 
                          currentLocation.speed, // This speed is already in KM/H from useLocationStore
                          currentLocation.heading, 
                          // timestamp, 
                          movementStateFromStore )
 
      } else if (!isOnline) {
          // console.log('[JobProcessing] Driver is offline, skipping location upload to Firebase.');
      }
    } catch (error) {
      console.error('[JobProcessing] Error during started job status processing:', error);
      nextUpdateInterval = ACTIVE_CONFIG.STOPPED_UPDATE_INTERVAL; // Fallback interval on error
    }
  }
  // console.log("leaving",  date.toISOString().slice(0, 19).replace('T', ' '));
  return { nextUpdateInterval  }; // Return the suggested interval for the caller.
};
 
const calculateJobPricing = (elapsedSeconds, distanceMeters, waitingSeconds) => {
  const { currentJob, updateCurrentJob } = useJobStore.getState();
  if (!currentJob || !currentJob.selectedTarrif) {
    // console.warn('Cannot calculate pricing: No current job or tariff found.');
    return;
  }

  const tariff = currentJob.selectedTarrif;
  // Ensure default values for tariff rates to prevent NaN issues.
  const startingPrice = parseFloat(tariff.startingPrice || 0);
  const distanceRate = parseFloat(tariff.distanceRate || 0);
  const timeRate = parseFloat(tariff.timeRate || 0);
  const waitingRate = parseFloat(tariff.waitingRate || 0);

  const distanceCost = (distanceMeters || 0) * distanceRate;
  const durationCost = (elapsedSeconds || 0) * timeRate;
  const waitingCost = (waitingSeconds || 0) * waitingRate;

  // Calculate total cost and format to 2 decimal places for currency.
  const totalCost = (startingPrice + distanceCost + durationCost + waitingCost).toFixed(2);
  // console.log("totalCost" , totalCost);
  try {
    updateCurrentJob({
      distanceTravelled: parseFloat(distanceMeters.toFixed(2)),
      earningsSoFar: totalCost,
      pricingBreakdown: {
        totalDistance: parseFloat(distanceMeters.toFixed(2)),
        duration: parseFloat(elapsedSeconds.toFixed(2)),
        waitingSeconds: parseFloat(waitingSeconds.toFixed(2)),
        distanceCost: parseFloat(distanceCost.toFixed(2)),
        durationCost: parseFloat(durationCost.toFixed(2)),
        waitingCost: parseFloat(waitingCost.toFixed(2)),
        startingPrice: startingPrice.toFixed(2), // Ensure consistent formatting
        totalCost: totalCost
      }
    },'pricingBreakdown');
  } catch (error) {
    console.error('[JobProcessing] Pricing calculation and update error:', error);
  }
};
 
const calculateHaversineDistance = (loc1, loc2) => {
  if (!loc1?.latitude || !loc1?.longitude || !loc2?.latitude || !loc2?.longitude) {
    return 0; // Return 0 if any coordinate is missing or invalid.
  }

  const R = 6371e3; // Earth's mean radius in meters.
  // Convert latitudes and longitude differences to radians.
  const φ1 = loc1.latitude * Math.PI / 180;
  const φ2 = loc2.latitude * Math.PI / 180;
  const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;

  // Haversine formula calculation.
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters.
};
 
const sleep = time => new Promise(resolve => setTimeout(resolve, time));
 