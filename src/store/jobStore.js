import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api'; // Your existing API service
import { REALTIMEJOB } from '../utils/constants'; // Your API constants

// Helper function to get driver data from AsyncStorage
const getDriver = async () => {
  try {
    const data = await AsyncStorage.getItem('DriverData');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('❌ Error getting driver data from AsyncStorage:', error);
    return null;
  }
};

// Terminal statuses that should clear the current job
const TERMINAL_STATUSES = ['finished', 'cancelled', 'noShow', 'recalled', 'rejected'];

const useJobStore = create((set, get) => ({
  currentJob: null,
  jobStatus: 'pending',
  isOnline: true,
  connectionStatus: 'disconnected', // Reflects the status from useDriverWebSocket
  socketMessage: null, // Last message received from WebSocket
  // --- WebSocket Integration ---
  // This will be set by the component wrapping the WebSocketProvider
  // to allow the store to send messages.
  sendWebSocketMessage: null,

  setSendWebSocketMessage: (func) => set({ sendWebSocketMessage: func }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSocketMessage: (message) => set({ socketMessage: message }),

  // Generic function to send job updates via WebSocket
  sendJobUpdateToWs: async (driverId, job, action) => {
    const { sendWebSocketMessage: sendWs } = get();
    // console.log(`Sending job update via WebSocket for action: ${action}`, job , sendWs);
    if (!sendWs) {
      console.warn('WebSocket send function not available in jobStore. Cannot send update.');
      // Consider a fallback to REST API or queue for later sync here if critical
      return;
    }

    try {

      job.coordinateHistory = [];
      const message = {
        event: 'job_update', // Consistent event type for all job data changes
        data: {
          driverId: driverId,
          job: job,
          action: action // Provides context for server-side logging/handling
        }
      };
      sendWs(message);
      socketMessage = message; // Store the last sent message for reference
      set({ socketMessage: message }); // Update the store with the last sent message
      // console.log(`✅ Job update sent via WebSocket for action: ${action}`);
    } catch (error) {
      console.error('❌ Failed to send job update via WebSocket:', error);
      // If WS send fails, save for offline sync
      await AsyncStorage.setItem('offlineJob', JSON.stringify(job));
      set({ isOnline: false }); // Mark as offline if WS fails
    }
  },

  // --- API Helper Functions (used for initial fetch or as fallback) ---
  fetchJobsFromApi: async (driverId) => {
    const driver = await getDriver();
    if (!driver) {
      console.warn('No driver data found. Cannot fetch jobs from API.');
      return [];
    }

    try {
      const response = await api.get(
        REALTIMEJOB.GET_DRIVER_ACTIVE_RIDE(driverId),
        { headers: { Authorization: `Bearer ${driver.token}` } }
      );
      // console.log("Response from fetchJobsFromApi:", response);
      if (response && response.data && response.data.rides && response.data.rides.length > 0) {
        // Return raw data, let handleServerJobUpdate transform it if needed
        return response.data.rides;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch jobs from API:', error);
      return [];
    }
  },

  deleteJobFromApi: async (driverId, jobId) => {
    const driver = await getDriver();
    if (!driver) {
      // console.warn('No driver data found. Cannot delete job from API.');
      return;
    }
    try {
      // TODO: Implement actual API delete call if necessary, as WS will handle this
      // console.log('Job deletion from API simulated (or handled by WebSocket).');
    } catch (error) {
      console.error('❌ Failed to delete job from API:', error);
      throw error;
    }
  },
  // --- End API Helper Functions ---

  initializeJobFromBackend: async (jobId = null) => {
    try {
      // console.log('Initializing job from Backend (via API fetch)...');
      const driver = await getDriver();
      if (!driver) {
        console.warn('No driver data found. Cannot initialize job.');
        set({ currentJob: null, jobStatus: 'pending' });
        return;
      }

      const jobs = await get().fetchJobsFromApi(driver.driverId);
      if (!jobs || jobs.length === 0) {
        set({ currentJob: null, jobStatus: 'pending' });
        return;
      }

      const validJob = jobs.find(job =>
        ['pending', 'accepted', 'displayed', 'rejected', 'on_the_way', 'arrived_ready',
          'arrived', 'started', 'completed', 'finished', 'cancelled',
          'paused', 'noShow', 'recalled'].includes(job.status)
      );

      if (validJob) {
        // Directly set the job as it comes from the API,
        // or ensure your API returns data in the expected `jobObject` format.
        // If not, you'd need a transformation function here (but not CreateJobObject from context)
        set({ currentJob: validJob, jobStatus: validJob.status });
      } else {
        set({ currentJob: null, jobStatus: 'pending' });
      }
    } catch (error) {
      console.error('❌ Failed to initialize job from Backend:', error.message);
    }
  },

  setIsOnline: async (status) => {
    set({ isOnline: status });
    const driver = await getDriver();
    if (!driver) return;

    if (status) {
      // When coming online, try to sync any stored offline job
      const offlineJobString = await AsyncStorage.getItem('offlineJob');
      if (offlineJobString) {
        try {
          const parsedOfflineJob = JSON.parse(offlineJobString);
          // Attempt to send the offline job via WebSocket
          // await get().sendJobUpdateToWs(driver.driverId, parsedOfflineJob, 'setIsOnline_sync');
          await AsyncStorage.removeItem('offlineJob');

          if (!TERMINAL_STATUSES.includes(parsedOfflineJob.status)) {
            set({ currentJob: parsedOfflineJob, jobStatus: parsedOfflineJob.status });
          }
        } catch (syncError) {
          console.error('❌ Failed to sync offline job:', syncError.message);
        }
      }
    }
  },

  // This action sets the current job, typically called by UI or initial load.
  // It ensures consistency and sends updates via WebSocket.
  setCurrentJob: async (job) => {
    const driver = await getDriver();
    if (!driver) {
      console.error('Cannot set job: Driver data not available.');
      return;
    }

    const fullJob = {
      ...job,
      coordinateHistory: job.coordinateHistory || []
    };

    if (TERMINAL_STATUSES.includes(fullJob.status)) {
      set({ currentJob: null, jobStatus: 'pending' });
      await AsyncStorage.removeItem('offlineJob'); // Clear offline job if it's terminal
      return;
    }

    set({ currentJob: fullJob, jobStatus: fullJob.status || 'pending' });

    // Always attempt to send job update via WebSocket if online
    if (get().isOnline) {
      // await get().sendJobUpdateToWs(driver.driverId, fullJob, 'setCurrentJob');
    } else {
      // If offline, store it for later sync
      await AsyncStorage.setItem('offlineJob', JSON.stringify(fullJob));
    }
  },

  setJobStatus: async (status) => {
    const driver = await getDriver();
    if (!driver) {
      console.error('Cannot set job status: Driver data not available.');
      return;
    }

    const job = get().currentJob;
    if (!job) {
      console.warn('No current job to update status.');
      return;
    }

    // Only update if status is different to avoid unnecessary updates
    if (job.status === status) {
      console.warn('Job status is already set to the requested status:', status);
      return;
    }

    const updated = { ...job, status };
    set({ currentJob: updated, jobStatus: status });

    if (get().isOnline) {
      // await get().sendJobUpdateToWs(driver.driverId, updated, 'setJobStatus');
    } else {
      await AsyncStorage.setItem('offlineJob', JSON.stringify(updated));
    }

    // Clear job if it reaches terminal status
    if (TERMINAL_STATUSES.includes(status)) {
      set({ currentJob: null, jobStatus: 'pending' });
      await AsyncStorage.removeItem('offlineJob');
    }
  },

  clearJob: async () => {
    const jobId = get().currentJob?.id;
    const driver = await getDriver();
    if (!driver) {
      console.error('Cannot clear job: Driver data not available.');
      return;
    }

    await AsyncStorage.removeItem('offlineJob');
    set({ currentJob: null, jobStatus: 'pending' });

    if (get().isOnline && jobId) {
      const { sendWebSocketMessage: sendWs } = get();
      if (sendWs) {
        sendWs({
          event: 'job_cleared',
          data: { driverId: driver.driverId, jobId: jobId }
        });
        // console.log('✅ Job clear message sent via WebSocket.');
      } else {
        try {
          await get().deleteJobFromApi(driver.driverId, jobId);
        } catch (error) {
          console.error('❌ Error deleting job from API (fallback):', error);
        }
      }
    }
  },

  updateCurrentJob: async (updates, action = 'manual_update') => {




    const driver = await getDriver();
    if (!driver) {
      console.error('Cannot update job: Driver data not available.');
      return;
    }

    const job = get().currentJob;
    if (!job) {
      console.warn('No current job to update.');
      return;
    }

    const updated = { ...job, ...updates };

    if (TERMINAL_STATUSES.includes(updated.status)) {
      set({ currentJob: null, jobStatus: 'pending' });
      await AsyncStorage.removeItem('offlineJob');
      return;
    }

    set({ currentJob: updated });

    if (get().isOnline && action == 'pricingBreakdown') {
          console.log('Action of the request:', action);
      await get().sendJobUpdateToWs(driver.driverId, updated, action);
    } else {
      await AsyncStorage.setItem('offlineJob', JSON.stringify(updated));
    }
  },

  addCoordinateToHistory: async (coord) => {
    const driver = await getDriver();
    if (!driver) {
      console.error('Cannot add coordinate: Driver data not available.');
      return;
    }

    const job = get().currentJob;
    if (!job) {
      console.warn('No current job to add coordinate history.');
      return;
    }

    const updated = {
      ...job,
      coordinateHistory: [
        ...(job.coordinateHistory || []),
        { ...coord, timestamp: new Date().toISOString() },
      ],
    };

    set({ currentJob: updated });

    // Location updates can be very frequent. Consider if you need to send
    // every coordinate, or batch them, or use a dedicated `location_update` event
    // with just the current position, and the server reconstructs history.
    if (get().isOnline) {
      // await get().sendJobUpdateToWs(driver.driverId, updated, 'addCoordinateToHistory');
    } else {
      await AsyncStorage.setItem('offlineJob', JSON.stringify(updated));
    }
  },

  // This action is specifically for handling incoming WebSocket messages
  // It receives already processed/transformed job data from useDriverWebSocket
  handleServerJobUpdate: async (message) => {
    const driver = await getDriver();
    if (!driver) {
      console.warn('No driver data to handle server job update.');
      return;
    }
    console.log("message", message);
    const { type, job, jobId } = message;

    switch (type) {
      case 'job_assigned':
        console.log("this is the job assigned");
        console.log(job);
         set({ currentJob: job, jobStatus: job.status || 'pending' });
 
      break;
      case 'job_updated':
        if (job) {
          // Set the job directly as it's already processed by CreateJobObject in useDriverWebSocket
          set({ currentJob: job, jobStatus: job.status });

          // If a job is assigned and its status is 'sending' (from server),
          // automatically change it to 'displayed' and inform the server.
          if (job.status === 'sending') {
            const updatedJobForDisplay = { ...job, status: 'displayed' };
            set({ currentJob: updatedJobForDisplay, jobStatus: 'displayed' });
            // Send this `displayed` status back to the server via WebSocket
            // await get().sendJobUpdateToWs(driver.driverId, updatedJobForDisplay, 'job_displayed_auto');
          }
        }
        break;
      case 'ride_cancelled':
        if (jobId) {
          // If the cancelled job is the current job, clear it.
          if (get().currentJob?.id === jobId) {
            set({ currentJob: null, jobStatus: 'pending' });
            await AsyncStorage.removeItem('offlineJob'); // Ensure offline state is cleared too
          }
          // console.log(`Job ${jobId} cancelled by server.`);
        }
        break;
      default:
        console.warn('Unhandled server job update type:', type, message);
    }
  },
}));

export default useJobStore;