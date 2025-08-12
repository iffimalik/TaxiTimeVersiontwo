import Geolocation from 'react-native-geolocation-service';
// Assuming calculateHaversineDistance is correctly imported and available
import { calculateHaversineDistance, driverLocationChange } from '../common.js'; 
// Assuming isServiceRunning is correctly imported and available
import { isServiceRunning } from '../../BackgroundService.js'; 
// Assuming useLocationStore is correctly imported and available
import useLocationStore from '../../store/locationStore'; 
 
import { processCurrentJobState } from './jobProcessor';
 import useJobStore from '../../store/jobStore'; // Import the job Zustand store
// Conversion constants
const MS_TO_KMH_FACTOR = 3.6; // 1 m/s = 3.6 km/h
const KMH_TO_MS_FACTOR = 1 / 3.6; // 1 km/h = 1/3.6 m/s
const msToKmh = (speedMs) => speedMs * MS_TO_KMH_FACTOR;
const kmhToMs = (speedKmh) => speedKmh * KMH_TO_MS_FACTOR;
// Configuration for vehicle movement detection
const VEHICLE_CONFIG = {
  // Movement thresholds (optimized for vehicles)
  // All speed values below are in kilometers per hour (km/h).
  MOVEMENT_THRESHOLD: 1,      // km/h - Speed above which vehicle is considered actively moving.
  STOPPED_SPEED_THRESHOLD: 1, // km/h - Speed below which vehicle is considered for being "stopped".
  IDLE_SPEED_TOLERANCE: 1, // km/h (Equivalent to ~0.05 m/s). Any speed below this is treated as effectively 0 km/h for state determination, helping with GPS drift.
  
  // Custom speed categories for detailed breakdown
  NORMAL_SPEED: 10,           // km/h
  LITTLE_HIGH_SPEED: 25,      // km/h
  MORE_SPEED: 50,             // km/h
  TOO_HIGH_SPEED: 75,         // km/h (75+ km/h is "too high speed")

  // Location validation criteria (remain in meters, distance, and milliseconds for time)
  MAX_ACCURACY: 15,        // meters - Maximum acceptable GPS accuracy
  MAX_JUMP_DISTANCE: 500,  // meters - Maximum distance between consecutive readings to prevent GPS jumps.
  MAX_PLAUSIBLE_SPEED: 200, // km/h (Equivalent to ~55.56 m/s). Maximum plausible speed for consistency checks.
  
  // Update intervals
  STOPPED_INTERVAL: 2000,  // ms - How often to process location when stopped.
  NORMAL_INTERVAL: 2000,   // ms - Interval for normal speed (e.g., 0-10 km/h)
  MOVING_INTERVAL: 1000,   // ms - How often to process location when actively moving (e.g., 10-25 km/h).
  LITTLE_HIGH_INTERVAL: 800, // ms - Interval for little high speed (e.g., 25-50 km/h)
  MORE_SPEED_INTERVAL: 600, // ms - Interval for more speed (e.g., 50-75 km/h)
  TOO_HIGH_SPEED_INTERVAL: 500, // ms - Interval for too high speed (75+ km/h)
  LOCATION_TIMEOUT: 2000   // ms - Timeout for a single precise location request.
};
export class VehicleMovementTracker {
  constructor() {
    this.state = 'STOPPED'; // Current movement state of the vehicle
    this.lastValidLocation = null; // Stores the last validated raw GPS location received from watchPosition.
    this.lastSuccessfullyProcessedLocation = null; // Stores the last valid location that was *processed* and confirmed to have unique coordinates.
    this.lastSpeed = 0; // Stores the last determined speed in KM/H (can be 0 when stopped)
    this.consecutiveStoppedReadings = 0; // Counter for consecutive readings indicating a stop
    this.consecutiveMovingReadings = 0; // Counter for consecutive readings indicating movement
    this.locationWatchId = null; // ID for the Geolocation watchPosition listener
    this.lastMovementTime = Date.now(); // Timestamp of the last confirmed movement (coordinate change)
    this.lastProcessedLocationTimestamp = null; // Timestamp of the last location successfully processed by processLocation (any valid timestamp)
    this.logPrefix = '[MovementTracker]'; // Prefix for console logs for easy filtering
    
    // State transition thresholds (number of consecutive readings required for transition)
    this.MOVING_TO_STOPPED_THRESHOLD = 2; // "2 times permanent" below 1.5 km/h to be considered STOPPED
    this.STOPPED_TO_MOVING_THRESHOLD = 2; // Number of readings above threshold to transition from STOPPED to MOVING

     this.isProcessingJob = false; // <--- NEW
  }

 
  async startWatching() {
    if (this.locationWatchId) {
      // console.log(`${this.logPrefix} Location watch already active`);
      return; // Prevent multiple watch listeners
    }

    // console.log(`${this.logPrefix} Starting location watch`);
    
    // Using a promise to allow awaiting the start of the watch, although
    // subsequent updates will come via the callback.
    return new Promise((resolve, reject) => {
      this.locationWatchId = Geolocation.watchPosition(
        (position) => {
          // This callback processes the raw position and updates useLocationStore.
          const location = this._processPosition(position);
            // console.log("location", location); 
          // console.log("processsingxxxxxx");
           
          // console.log("location", location);
          // Resolve the promise only when the very first valid location is received.
          if (location && !this.lastValidLocation) {
        
       
            resolve(location);

            
          } else if (!location && !this.lastValidLocation) {
            // If the very first position is invalid, we might wait for a valid one.
            // For now, it will continue to wait for a valid location.

          }

        },
        (error) => {
          console.warn(`${this.logPrefix} Location watch error:`, error);
          // If it's the initial error and no location has been received, reject.
          if (!this.lastValidLocation) {
            reject(error);
          }
        },
        {
          enableHighAccuracy: true,         // Request high accuracy GPS
          distanceFilter: 1,                // Update every 1 meter movement
          interval: VEHICLE_CONFIG.MOVING_INTERVAL,         // Minimum interval between updates (ms)
          fastestInterval: VEHICLE_CONFIG.TOO_HIGH_SPEED_INTERVAL,   // Fastest interval between updates (ms)
        }
      );
    });
  }

  /**
   * Stops the active GPS position watch.
   */
  stopWatching() {
    if (this.locationWatchId) {
      console.log(`${this.logPrefix} Stopping location watch`);
      Geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null; // Reset the watch ID
    }
  }
 
  _processPosition(position) {
    // Basic validation of position data
    if (!position?.coords) {
      console.warn(`${this.logPrefix} Invalid position data received.`);
      return null;
    }

    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed, // This is still in m/s from Geolocation API
      heading: position.coords.heading,
      timestamp: position.timestamp || Date.now() // Use timestamp from position or current time
    };

    // Perform detailed validation
    if (!this._isValidLocation(location)) {
      return null;
    }

    // Update the global location store with the latest valid location.
    // Convert speed to KM/H for the store as useLocationStore expects KM/H.

    useLocationStore.getState().setHeading(location.heading);
    useLocationStore.getState().setSpeed(msToKmh(location.speed));
    useLocationStore.getState().setAccuracy(location.accuracy);
    
    useLocationStore.getState().setLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      
       // Also update movement state and next update interval in location store for global access
      movementState: this.state, // Pass the current tracker state
      nextUpdateInterval: this._getUpdateInterval(this.state, false), // Calculate current interval
      isStale: false // Indicate it's fresh data
    });

    // Store as the last valid location for internal tracking, to be used by processLocation
    this.lastValidLocation = location; // Storing the raw m/s speed for internal calculations
  
    return location;
  }

  
  _hasLocationActuallyChanged(newLocation, previousProcessedLocation) {
    // If there's no previous processed location, any new valid location is considered a change.
    if (!previousProcessedLocation || !newLocation) {
      return previousProcessedLocation !== null && newLocation !== null;
    }
    // Use a very small epsilon to account for floating point inaccuracies and minor GPS jitter
    const EPSILON = 0.0000001; 
    return (
      Math.abs(newLocation.latitude - previousProcessedLocation.latitude) > EPSILON ||
      Math.abs(newLocation.longitude - previousProcessedLocation.longitude) > EPSILON
    );
  }

 
  processLocation(location) {
    const currentTime = Date.now();
    let trulyNewCoordinateData = false; // Flag to indicate if coordinates have genuinely changed since last successful process
    let currentSpeedMs = 0; // Initialize actual speed in m/s (from GPS or calculated)

    // Check if the received location is truly new (newer timestamp AND different coordinates from last *processed*)
    // `location` parameter here is `this.lastValidLocation` from the mainBackgroundTask loop,
    // which is asynchronously updated by `_processPosition`.
    if (location && (this.lastProcessedLocationTimestamp === null || location.timestamp > this.lastProcessedLocationTimestamp)) {
        // A new timestamp means _processPosition has received a new GPS reading.
        // Now, check if the coordinates are actually different from the *previously successfully processed* location.
        trulyNewCoordinateData = this._hasLocationActuallyChanged(location, this.lastSuccessfullyProcessedLocation);
        
        if (trulyNewCoordinateData) {
            console.log(`${this.logPrefix} New coordinates AND/OR first location detected. Vehicle is potentially moving.`);
            this.lastMovementTime = currentTime; // Reset last movement time on actual coordinate change
        } else {
            console.log(`${this.logPrefix} New timestamp, but coordinates effectively unchanged from last processed. (GPS jitter/static mock).`);
        }
        // Always update lastProcessedLocationTimestamp if we received a newer timestamp from Geolocation API
        this.lastProcessedLocationTimestamp = location.timestamp;
    } else {
        // No new `location` object provided to processLocation (meaning watchPosition hasn't given new data),
        // or its timestamp is not newer than the last one we processed.
        console.log(`${this.logPrefix} No new location update or timestamp not newer. Assuming no real movement.`);
        trulyNewCoordinateData = false; // If no new data, then no true coordinate change for this cycle
    }

    // Determine current speed based on the latest valid raw data.
    // If 'location' is null, _getReliableSpeed will return 0 m/s.
    currentSpeedMs = this._getReliableSpeed(location);
    const currentSpeedKmh = msToKmh(currentSpeedMs); // Convert to KM/H for comparison with VEHICLE_CONFIG

    let effectiveSpeedForStateKmh = currentSpeedKmh; 
    
    // Crucial for stopping: If coordinates haven't truly changed OR if current speed is below tolerance,
    // force effective speed to 0 for state determination. This handles mock app stillness and GPS drift.
    if (!trulyNewCoordinateData || currentSpeedKmh < VEHICLE_CONFIG.IDLE_SPEED_TOLERANCE) { 
        effectiveSpeedForStateKmh = 0; // Force effective speed to 0 if no true coordinate change or below idle tolerance
    }

    // Update consecutive counters based on the effective speed.
    // These counters drive the state transitions.
    if (effectiveSpeedForStateKmh > VEHICLE_CONFIG.MOVEMENT_THRESHOLD) {
      this.consecutiveMovingReadings++;
      this.consecutiveStoppedReadings = 0;
    } else { // effectiveSpeedForStateKmh is 0 or very low, indicating stillness
      this.consecutiveStoppedReadings++;
      this.consecutiveMovingReadings = 0;
    }

    console.log(`${this.logPrefix} Movement check:`, {
      actualSpeed_kmh: currentSpeedKmh.toFixed(2), // Raw speed in km/h
      effectiveSpeed_kmh: effectiveSpeedForStateKmh.toFixed(2), // Speed in km/h used for state logic
      trulyNewCoordinateData: trulyNewCoordinateData, // For logging clarity
      movingCount: this.consecutiveMovingReadings,
      stoppedCount: this.consecutiveStoppedReadings,
      currentState: this.state
    });

    // --- State Transition Logic ---
    if (this.state === 'STOPPED') {
      // Transition from STOPPED to MOVING (any category)
      // Requires enough consecutive readings above MOVEMENT_THRESHOLD and actual movement detected.
      if (this.consecutiveMovingReadings >= this.STOPPED_TO_MOVING_THRESHOLD && currentSpeedKmh >= VEHICLE_CONFIG.STOPPED_SPEED_THRESHOLD) {
        console.log(`${this.logPrefix} State changed from STOPPED to MOVING (or higher speed).`);
        this.state = this._getSpeedCategory(currentSpeedKmh); // Set to appropriate speed category
        this.lastMovementTime = currentTime; // Update last movement time on state change
      }
    } 
    else { // Currently MOVING or any higher speed category
      // Transition to STOPPED if we have enough consecutive stillness readings
      // OR if the actual speed drops below the STOPPED_SPEED_THRESHOLD for long enough.
      if (this.consecutiveStoppedReadings >= this.MOVING_TO_STOPPED_THRESHOLD || currentSpeedKmh < VEHICLE_CONFIG.STOPPED_SPEED_THRESHOLD) {
        console.log(`${this.logPrefix} State changed to STOPPED (consecutive low-speed/static readings or speed below ${VEHICLE_CONFIG.STOPPED_SPEED_THRESHOLD} km/h).`);
        this.state = 'STOPPED';
        this.lastSpeed = 0; // Crucial: Force lastSpeed to 0 km/h when transitioning to STOPPED
      }
      // Only change speed category if not STOPPED and speed has changed meaningfully
      else {
        const newSpeedCategory = this._getSpeedCategory(currentSpeedKmh);
        if (this.state !== newSpeedCategory) {
          console.log(`${this.logPrefix} State changed within moving categories from ${this.state} to ${newSpeedCategory}`);
          this.state = newSpeedCategory;
        }
      }
    }

    // Final update of `lastSpeed` for reporting. This will be in KM/H.
    // Crucial: If the state is 'STOPPED', the reported speed MUST be 0. Otherwise, report the actual current speed in KM/H.
    this.lastSpeed = (this.state === 'STOPPED') ? 0 : currentSpeedKmh;

    // Update `lastSuccessfullyProcessedLocation` for future `_hasLocationActuallyChanged` checks.
    // Store the raw m/s speed and timestamp for correct haversine calculations in _getReliableSpeed.
    if (location) {
        this.lastSuccessfullyProcessedLocation = { ...location }; 
    }

    // Return current state information.
    // Indicate `isStale` if no truly new coordinate data has been received recently
    // and the system believes the vehicle is currently stopped.
    return this._getCurrentState(
        !trulyNewCoordinateData && 
        (currentTime - this.lastMovementTime > VEHICLE_CONFIG.STOPPED_INTERVAL) &&
        this.state === 'STOPPED' 
    );
  }

  
  _isValidLocation(location) {
    if (!location?.latitude || !location?.longitude) {
      console.warn(`${this.logPrefix} Validation failed: Missing coordinates.`);
      return false;
    }

    // Ensure speed is not negative
    if (location.speed !== undefined && location.speed < 0) {
      console.warn(`${this.logPrefix} Validation failed: Negative speed detected (${location.speed} m/s).`);
      return false;
    }

    if (location.accuracy > VEHICLE_CONFIG.MAX_ACCURACY) {
      console.warn(`${this.logPrefix} Validation failed: Poor accuracy (${location.accuracy}m).`);
      return false;
    }

    // Check for impossible jumps if there's a last valid location
    // Note: `this.lastValidLocation` here refers to the *previous* raw valid location,
    // not necessarily the last `processed` one. Speeds are in m/s for calculations.
    if (this.lastValidLocation) {
      const distance = calculateHaversineDistance(this.lastValidLocation, location);
      const timeDiff = (location.timestamp - this.lastValidLocation.timestamp) / 1000; // Time difference in seconds
      
      // Calculate max allowed distance based on max plausible speed (converted from km/h to m/s) and time elapsed
      const maxDistance = Math.min(
        VEHICLE_CONFIG.MAX_JUMP_DISTANCE, // Hard cap on jump distance (meters)
        kmhToMs(VEHICLE_CONFIG.MAX_PLAUSIBLE_SPEED) * timeDiff // Distance based on max plausible speed in m/s
      );

      if (distance > maxDistance) {
        console.warn(`${this.logPrefix} Validation failed: Impossible jump detected!`, {
          distance: distance.toFixed(2), // Format for readability
          maxAllowed: maxDistance.toFixed(2),
          timeDiff: timeDiff.toFixed(2),
          lastLat: this.lastValidLocation.latitude,
          lastLng: this.lastValidLocation.longitude,
          currLat: location.latitude,
          currLng: location.longitude,
        });
        return false;
      }
    }

    return true; // Location passed all validation checks
  }
 
  _getReliableSpeed(location) {
    // Prioritize reported speed if available and valid (non-negative)
    if (location && location.speed !== undefined && location.speed >= 0) {
      return location.speed; // This speed is in m/s
    }

    // Fallback to calculated speed if reported speed is missing or invalid.
    // Calculate speed between the *last processed unique location* and the current `location`.
    if (this.lastSuccessfullyProcessedLocation && location) {
      const distance = calculateHaversineDistance(this.lastSuccessfullyProcessedLocation, location);
      const timeDiff = (location.timestamp - this.lastSuccessfullyProcessedLocation.timestamp) / 1000; // in seconds
      let calculatedSpeedMs = 0;

      if (timeDiff > 0) {
          calculatedSpeedMs = distance / timeDiff; // This calculated speed is in m/s
      } else {
          // If timeDiff is 0, it means the timestamps are identical, implying no movement
          // or a very rapid update with no time progression. Speed should be 0 m/s.
          calculatedSpeedMs = 0;
      }
      
      console.log(`${this.logPrefix} Calculated speed (fallback, due to missing native speed or time diff 0):`, {
        calculatedSpeed_ms: calculatedSpeedMs.toFixed(2),
        distance: distance.toFixed(2),
        timeDiff: timeDiff.toFixed(2)
      });
      
      return calculatedSpeedMs;
    }

    return 0; // Default to 0 m/s if no valid speed can be determined
  }

  
  _getSpeedCategory(speedKmh) {
    if (speedKmh < VEHICLE_CONFIG.STOPPED_SPEED_THRESHOLD) {
      return 'STOPPED';
    } else if (speedKmh < VEHICLE_CONFIG.NORMAL_SPEED) {
      return 'NORMAL_SPEED';
    } else if (speedKmh < VEHICLE_CONFIG.LITTLE_HIGH_SPEED) {
      return 'LITTLE_HIGH_SPEED';
    } else if (speedKmh < VEHICLE_CONFIG.MORE_SPEED) {
      return 'MORE_SPEED';
    } else { // speedKmh >= VEHICLE_CONFIG.TOO_HIGH_SPEED
      return 'TOO_HIGH_SPEED';
    }
  }

   
  _getCurrentState(isStale = false) {
    const speedCategory = this._getSpeedCategory(this.lastSpeed);
    
    const state = {
      currentState: this.state, // STOPPED, NORMAL_SPEED, LITTLE_HIGH_SPEED, MORE_SPEED, TOO_HIGH_SPEED
      speed: this.lastSpeed,   // Last determined speed (in KM/H)
      speedCategory: speedCategory, // Categorized speed level
      isStale: isStale,   // Indicates if the data is based on stale location info
      nextUpdateInterval: this._getUpdateInterval(this.state, isStale) // How long to wait until next processing cycle
    };

    console.log(`${this.logPrefix} Current state returned:`, state);
    return state;
  }

  
  _getUpdateInterval(currentState, isStale) {
    if (isStale) {
      // If data is stale (no new GPS updates), check more frequently to see if it resumes
      // or to confirm stopped state more quickly.
      return 1000; 
    }

    // Return interval based on the current determined state
    switch (currentState) {
      case 'STOPPED':
        return VEHICLE_CONFIG.STOPPED_INTERVAL;
      case 'NORMAL_SPEED':
        return VEHICLE_CONFIG.NORMAL_INTERVAL;
      case 'LITTLE_HIGH_SPEED':
        return VEHICLE_CONFIG.LITTLE_HIGH_INTERVAL;
      case 'MORE_SPEED':
        return VEHICLE_CONFIG.MORE_SPEED_INTERVAL;
      case 'TOO_HIGH_SPEED':
        return VEHICLE_CONFIG.TOO_HIGH_SPEED_INTERVAL;
      case 'MOVING': // Default moving interval, if states are not granularly separated
        return VEHICLE_CONFIG.MOVING_INTERVAL;
      default:
        // Fallback for any unhandled state (shouldn't happen)
        return VEHICLE_CONFIG.STOPPED_INTERVAL;
    }
  }
}
export const getPreciseLocation = async () => {
  console.log('[Location] Requesting precise location');
  try {
    const position = await new Promise((resolve, reject) => {
      // Set a timeout for the precise location request
      const timer = setTimeout(() => {
        console.warn('[Location] Precise location timeout reached.');
        reject(new Error('Location timeout'));
      }, VEHICLE_CONFIG.LOCATION_TIMEOUT);

      Geolocation.getCurrentPosition(
        position => {
          clearTimeout(timer); // Clear the timeout if position is acquired
          console.log('[Location] Precise location acquired', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          resolve(position);
        },
        error => {
          clearTimeout(timer); // Clear the timeout on error
          console.warn('[Location] Precise location error', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,         // Request high accuracy
          timeout: VEHICLE_CONFIG.LOCATION_TIMEOUT, // Geolocation API timeout
          maximumAge: 0,                    // Get the freshest possible location
          forceRequestLocation: true        // Force a new location acquisition
        }
      );
    });

    // Construct the location object from the position data
    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed, // This is still in m/s
      heading: position.coords.heading,
      timestamp: position.timestamp || Date.now()
    };

    // Update the global location store. Convert speed to KM/H for the store.
    useLocationStore.getState().setLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      accuracy: location.accuracy,
      speed: msToKmh(location.speed) // Convert speed to km/h for the store
    });
  

    return location;
  } catch (error) {
    console.warn('[Location] Precise location failed:', error.message);
    return null;
  }
};
export const mainBackgroundTask = async (taskData) => {
 
  const tracker = new VehicleMovementTracker();
    
  try {
    
    while (isServiceRunning() ) {  
      try {
       
           tracker.startWatching();
      
        const currentLocationStoreState = useLocationStore.getState();
     
        const { 
            latitude, 
            longitude, 
            accuracy, 
            speed, // This speed is already in KM/H from useLocationStore
            heading, 
            timestamp, 
            movementState 
        } = currentLocationStoreState;
        if (speed > VEHICLE_CONFIG.NORMAL_SPEED) {
     
             await  driverLocationChange(latitude, 
                  longitude, 
                  accuracy, 
                  speed, // This speed is already in KM/H from useLocationStore
                  heading, 
                  movementState )
           }
      
        const latestLocationForJob = latitude ? {
          latitude, longitude, accuracy, speed, heading, timestamp
        } : null;
           
        let date = new Date();

        

     
           console.warn("Enteerence Time " , date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds()  );
        if (useJobStore.getState().currentJob != null) {
          const { nextUpdateInterval, isJobActive = true } = await processCurrentJobState(
            latestLocationForJob,
            movementState // Pass the movement state string directly from useLocationStore
          );
        // console.log("nextUpdateInterval1111", nextUpdateInterval , isJobActive);
            if(isJobActive == false){
                tracker.isProcessingJob = true;
            } else {
                tracker.isProcessingJob = false;
            }
          console.warn("Return  Time", date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds());
           console.log("sleeptime is " , nextUpdateInterval);
          await sleep(nextUpdateInterval); 
          
        } else {
          console.log("sleeptime is 3000");
           await sleep(3000); 
       }
           
        
      } catch (error) {
        console.error('[BackgroundTask] Error during processing cycle:', error);
        tracker.isProcessingJob = false;
        console.log("sleeptime is" , VEHICLE_CONFIG.STOPPED_INTERVAL);
        await sleep(VEHICLE_CONFIG.STOPPED_INTERVAL); 
      }
    }
   

   
  } finally {
    // Ensure the location watch is stopped when the background service eventually stops.
    tracker.stopWatching();
    console.log('[BackgroundTask] Stopped main task loop.');
  }
};
const sleep = time => new Promise(resolve => setTimeout(resolve, time));

