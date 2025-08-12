// store/locationStore.js
import { create } from 'zustand';
// Use React Native Firebase imports
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Assuming AsyncStorage is available in React Native

// Assuming useJobStore is correctly imported and available for online status check
import useJobStore from '../store/jobStore'; 
import { ENDPOINTS } from '../utils/constants';

// --- Firebase Initialization (Adapted for React Native Firebase) ---
// In React Native with @react-native-firebase, Firebase is typically initialized
// natively, so we don't call initializeApp here. We directly use auth() and database().
let currentFirebaseUserId = null; // Track current user ID from auth state listener
let cachedCompanyId = null; // Cache CompanyId to avoid repetitive AsyncStorage reads
let cachedDriverData = null; // Cache DriverData if it's needed for other logic

/**
 * Sets up Firebase authentication listener for React Native Firebase.
 * This should ideally be called once at app startup (e.g., in App.js or a root component).
 * For a Zustand store, we can call it directly, but note it doesn't initialize the app
 * itself, only sets up the auth listener.
 */
const setupReactNativeFirebaseAuthListener = async () => {
  // Sign in using the provided custom token or anonymously on app start if not already authenticated
  // This part might be managed by a higher-level authentication flow.
  // For this store, we'll ensure the auth listener is active.
  
  // Listen for auth state changes to keep track of the current user ID
  auth().onAuthStateChanged(async (user) => {
    if (user) {
      currentFirebaseUserId = user.uid;
      // console.log(`[Firebase Auth] User authenticated: ${currentFirebaseUserId}`);
      // Re-fetch cached data if user changes (or on initial auth)
      try {
        cachedCompanyId = await AsyncStorage.getItem('CompanyId') || 'defaultCompany';
        const driverDataString = await AsyncStorage.getItem('DriverData');
        cachedDriverData = driverDataString ? JSON.parse(driverDataString) : {};
      } catch (error) {
        console.error("[AsyncStorage] Error fetching cached data on auth state change:", error);
      }
    } else {
      currentFirebaseUserId = null;
      console.log("[Firebase Auth] No user signed in.");
      cachedCompanyId = null; // Clear cache if no user
      cachedDriverData = null;
    }
  });

  // Attempt initial sign-in if no user is currently authenticated (optional, can be done elsewhere)
  if (!auth().currentUser) {
    try {
      // Check for __initial_auth_token from the Canvas environment, though this is primarily for web.
      // In a pure React Native app, this token would typically come from an external source or deep link.
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await auth().signInWithCustomToken(__initial_auth_token);
        console.log("[Firebase Auth] Signed in with custom token (via initial token).");
      } else {
        await auth().signInAnonymously();
        console.log("[Firebase Auth] Signed in anonymously (no initial token).");
      }
    } catch (error) {
      console.error("[Firebase Auth] Error during initial sign-in:", error);
    }
  }
};

// Call the auth listener setup once when the module loads
setupReactNativeFirebaseAuthListener();

// --- Zustand Store Definition ---
const useLocationStore = create((set, get) => ({
  // Raw location data
  latitude: null,
  longitude: null,
  heading: 0,
  speed: 0, // This speed is assumed to be in KM/H based on original uploadLocationToFirebase context
  accuracy: null,
  altitude: null,
  altitudeAccuracy: null,
  
  // Processed data
  isMoving: false,
  movementState: 'stopped', // 'stopped' | 'moving' | 'high_speed'
  isBackgroundServiceRunning: false,
  
  // History and smoothing
  history: [],
  displayLocation: {
    latitude: null,
    longitude: null,
    accuracy: null
  },
  
  // Timestamps
  lastUpdated: null,
  lastMovementTime: null,
  
  // Statistics
  totalDistance: 0,
  currentTripDistance: 0,
  setDistance: (distance) => set({ totalDistance: get().totalDistance + distance }),
  setHeading: (heading) => set({ heading }),
  setSpeed: (speed) => set({ speed }),
  setAccuracy: (accuracy) => set({ accuracy }),
  // Methods
  /**
   * Sets the current location data in the store and triggers a Firebase upload.
   * @param {object} data - The location data object (latitude, longitude, speed, etc.).
   * Speed in this data object is expected to be in KM/H.
   */
  setLocation: async (data) => {
    const now = new Date().toISOString();

    let currentLocation =  {
      type: 'Point',
      coordinates: [
        data.longitude, 
        data.latitude, 
      ]
    };
     

    const newEntry = {
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading ?? get().heading,
      speed: data.speed ?? get().speed, // Speed expected in KM/H here
      accuracy: data.accuracy ?? get().accuracy,
      altitude: data.altitude ?? get().altitude,
      timestamp: now
    };

    const currentHistory = get().history || [];
    const newHistory = [...currentHistory, newEntry].slice(-100); // Keep last 100 entries
    
    // Determine movement state based on the provided speed (in KM/H)
    const isMoving = data.speed > 0.5; // Threshold for movement (0.5 KM/H)
    const movementState = isMoving ? 
      (data.speed > 15 ? 'high_speed' : 'moving') : 'stopped'; // Speed thresholds for categories
    
    // Update the Zustand store's state synchronously
    set({
      ...newEntry,
      history: newHistory,
      lastUpdated: now,
      isMoving,
      movementState, // Set the determined movement state
      displayLocation: {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy
      },
      ...(isMoving && { lastMovementTime: now })
    });

    // --- Firebase Location Upload (Asynchronous) ---
    // (async () => {
    //   // Get the current user ID directly from @react-native-firebase auth
    //   const userId = auth().currentUser?.uid;

    //   if (!userId) {
    //     console.warn('No authenticated user ID for Firebase upload. Skipping location upload.');
    //     return;
    //   }

    //   // Check if the driver is online using the useJobStore
    //   const isOnline = useJobStore.getState().isOnline;

    //   if (isOnline) {
    //     // Fetch CompanyId and DriverData from AsyncStorage if not cached
    //     // This reintroduces the logic from the very first prompt for RN context
    //     if (!cachedCompanyId) {
    //       try {
    //         cachedCompanyId = await AsyncStorage.getItem('CompanyId') || 'defaultCompany';
    //       } catch (error) {
    //         console.error("[AsyncStorage] Error fetching CompanyId:", error);
    //         return; // Skip upload if essential data can't be retrieved
    //       }
    //     }
    //     if (!cachedDriverData) {
    //       try {
    //         const driverDataString = await AsyncStorage.getItem('DriverData');
    //         cachedDriverData = driverDataString ? JSON.parse(driverDataString) : {};
    //       } catch (error) {
    //         console.error("[AsyncStorage] Error fetching DriverData:", error);
    //         // Continue even if DriverData fails, as it's not critical for the upload path
    //       }
    //     }

    //     try {
    //       // console.log(`[Firebase Upload] Uploading location for user ${userId} to Firebase.`);
    //       // Use @react-native-firebase database syntax
    //       // await database()
    //       //   .ref(`companies/${cachedCompanyId}/onlineAgents/${userId}/currentLocation`)
    //       //   .update({
    //       //     latitude: newEntry.latitude,
    //       //     longitude: newEntry.longitude,
    //       //     timestamp: database.ServerValue.TIMESTAMP, // Use server timestamp for accuracy
    //       //     heading: newEntry.heading || 0,
    //       //     accuracy: newEntry.accuracy || 999, // Provide a default if accuracy is missing
    //       //     movementType: movementState, // Use the movement state determined in setLocation
    //       //     speed: newEntry.speed // Use the speed from the newEntry (which is in KM/H)
    //       //   });
    //       // console.log('[Firebase Upload] Location uploaded successfully.');
    //     } catch (error) {
    //       console.error('[Firebase Upload] Error uploading location to Firebase:', error);
    //       // Consider adding more sophisticated error handling or retry logic here
    //     }
    //   } else {
    //     console.log('[Firebase Upload] Driver is offline, skipping location upload to Firebase.');
    //   }
    // })();
    (async () => {
  if (!user?.uid) {
    console.warn('No authenticated user ID for Firebase upload. Skipping location upload.');
    return;
  }

  const userId = user.uid;

  const isOnline = useJobStore.getState().isOnline;

  if (!isOnline) {
    console.log('[Firebase Upload] Driver is offline, skipping location upload to Firebase.');
    return;
  }

  try {
    if (!cachedCompanyId) {
      cachedCompanyId = await AsyncStorage.getItem('CompanyId') || 'defaultCompany';
    }

    if (!cachedDriverData) {
      const driverDataString = await AsyncStorage.getItem('DriverData');
      cachedDriverData = driverDataString ? JSON.parse(driverDataString) : {};
    }
  } catch (error) {
    console.error('[AsyncStorage] Error retrieving essential data:', error);
    return;
  }

      try {
    
        // TODO this need to manage later
    // Example Firebase update
    // await database()
    //   .ref(`companies/${cachedCompanyId}/onlineAgents/${userId}/currentLocation`)
    //   .update({
    //     latitude: newEntry.latitude,
    //     longitude: newEntry.longitude,
    //     timestamp: database.ServerValue.TIMESTAMP,
    //     heading: newEntry.heading || 0,
    //     accuracy: newEntry.accuracy || 999,
    //     movementType: movementState,
    //     speed: newEntry.speed,
    //   });

    // console.log('[Firebase Upload] Location uploaded successfully.');
  } catch (error) {
    console.error('[Firebase Upload] Error uploading location to Firebase:', error);
  }
})();

    // --- End Firebase Location Upload ---
  },
  
  setMovementState: (state) => set({ movementState: state }),
  setBackgroundServiceRunning: (isRunning) => set({ isBackgroundServiceRunning: isRunning }),
  
  // Trip management
  startNewTrip: () => set({ currentTripDistance: 0 }),
  addDistance: (distance) => set({ 
    totalDistance: get().totalDistance + distance,
    currentTripDistance: get().currentTripDistance + distance 
  }),
  
  // Helpers
  // Ensure speed is correctly formatted for display if needed
  getCurrentSpeedKPH: () => get().speed?.toFixed(1) ?? 'N/A', 
  getCurrentAccuracy: () => get().accuracy?.toFixed(1) ?? 'N/A',
  
  clearHistory: () => set({ history: [] })
}));

export default useLocationStore;
