import React, { useState, useEffect, useRef, useCallback, useContext, use } from 'react';
import {
Text,
StyleSheet,
TouchableOpacity,
StatusBar,
Alert,
View,
FlatList,
SafeAreaView,
ActivityIndicator,
RefreshControl,
ScrollView,
Dimensions, // For responsiveness
Animated,   // For animations
LayoutAnimation, // For subtle layout changes
UIManager, // For LayoutAnimation on Android
Modal, // For vehicle selection modal
TextInput, // For vehicle input
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Using MaterialCommunityIcons
import auth from '@react-native-firebase/auth'; // Assuming Firebase Auth is set up
import useJobStore from '../../store/jobStore';
import useLocationStore from '../../store/locationStore';
import { ShiftContext } from '../../context/ShiftContext';
import { startService, stopService } from './../../BackgroundService'; // Assuming these exist
import NetworkBanner from './NetworkBanner'; // Assuming this component exists
import ShiftOverview from './HomeComponent/ShiftOverview'; // Assuming this component exists
import LocationDisplay from './HomeComponent/LocationDisplay'; // Assuming this component exists
import CurrentAddress from './HomeComponent/CurrentAddress'; // Assuming this component exists
import { useNavigation } from '@react-navigation/native'; // For navigation
import { showConfirmationToast, showInfoToast, showSuccessToast  , showErrorToast} from '../../utils/showToast';
//  import messageSound from '../../assets/sound/whatsapp.mp3'; // Assuming you have a sound file for new messages
import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shiftStatusChange } from '../../utils/common';
import { JOBENDPOINT } from '../../utils/constants';
import api from '../../services/api';
import { create } from 'zustand';
import { TarrifContext } from '../../context/TarrifContext';
// import { setupAudio , playNewMessageSound } from './AudioMessage';
// import Sound from 'react-native-sound'; // Import react-native-sound


// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
}

// Get screen dimensions for responsiveness
const { width, height } = Dimensions.get('window');
const SPACING_HORIZONTAL = width * 0.04; // 4% of screen width for horizontal spacing
const CARD_WIDTH = (width - SPACING_HORIZONTAL * 3) / 2; // For two cards in a row
const OVERVIEW_ITEM_WIDTH = (width - SPACING_HORIZONTAL * 4) / 3; // For three items in overview

// Helper for time formatting (e.g., for online time)
const formatDuration = (seconds) => {
const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secondsLeft = seconds % 60;
if (hours > 0) {
  return `${hours}h ${minutes}m \n  ${secondsLeft}s`;
}
return `${minutes}m ${secondsLeft}s`;
};

const HomeScreen = () => {
const navigation = useNavigation();
const [logoutLoading, setLogoutLoading] = useState(false);
const [refreshing, setRefreshing] = useState(false);
const [showVehicleModal, setShowVehicleModal] = useState(false);
const [tempVehiclePlate, setTempVehiclePlate] = useState('');
const [tempVehicleModel, setTempVehicleModel] = useState('');

const { shiftStarted, shiftStartTime, selectedVehicle, shiftCloseTime, startShift, endShift ,  driver , vehicles  } = useContext(ShiftContext);
const {clearSelectedTarrif , isNeedtoRefresh, selectedTarrif, isTarrifSelected , availableTariffs , detectedZone } = useContext(TarrifContext);
  const { currentJob, setCurrentJob, setJobStatus, setIsOnline } = useJobStore();
const { isBackgroundServiceRunning  , latitude, longitude} = useLocationStore();
  

// Animation value for fade-in effect
const fadeAnim = useRef(new Animated.Value(0)).current;

// Mock Data (replace with API calls)
const [todayEarnings, setTodayEarnings] = useState(0);
const [tripsCompletedToday, setTripsCompletedToday] = useState(0);
const [onlineTime, setOnlineTime] = useState(0); // in seconds
  const onlineTimer = useRef(null);
    const [messageSound, setMessageSound] = useState(null); // State to hold the sound instance
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [driverDetails, setDriverDetails] = useState(null); // To hold driver details 
  const userId = auth().currentUser?.uid;
   // Load the sound file outside useEffect
 
  
    const CreateJobObject = async (response) => {
  try {
    if (!response) return null;

    if (!selectedTarrif?.id)
      return showErrorToast('Error', 'Please select a tariff before accepting a job.');

    const {
      id,
      pickupLocation,
      dropoffLocation,
      createdAt,
      pickupTime,
      dropoffTime,
      fare,
      earningsSoFar,
      status,
      distance,
      duration,
      rider,
      notes,
      tarrif,
    } = response;

    const jobObject = {
      id: id || '',
      pickupLocation: pickupLocation?.address || 'N/A',
      dropoffLocation: dropoffLocation?.address || 'N/A',
      pickupLat: pickupLocation?.latitude || 0,
      pickupLng: pickupLocation?.longitude || 0,
      dropoffLat: dropoffLocation?.latitude || 0,
      dropoffLng: dropoffLocation?.longitude || 0,
      destination: dropoffLocation?.address || 'N/A',
      CreatedAt: createdAt || new Date().toISOString(),
      pickupTime: pickupTime || '',
      dropoffTime: dropoffTime || '',
      earningsSoFar: earningsSoFar || '0.00',
      estimatedFare: fare ?? '0.00',
      status: status || 'pending',
      distance: distance ?? '0.0',
      estimatedDuration: duration || 'N/A',
      riderName: rider?.name || 'Guest User',
      riderPhone: rider?.phoneNumber || '+974 123123123',
      notes: notes || '',
      vehicle: {
        model: selectedTarrif?.name ? `${selectedTarrif.name} Tier` : 'Standard Vehicle',
        color: 'White',
      },
      destinationLat: dropoffLocation?.latitude || 0,
      destinationLng: dropoffLocation?.longitude || 0,
      coordinateHistory: [],
      driver_job_start_time: null,
      driver_job_end_time: null,
      tarrif: selectedTarrif?.id || '0', // Default to a standard tariff
      selectedTarrif : selectedTarrif
    };

    // console.log('🚗 JOB Object:', jobObject);
    return jobObject;
  } catch (error) {
    console.error('❌ Error creating job object:', error.message);
    return null;
  }
};

  const fetchPendingJob = async () => {
    try {
      const response = await api.get(JOBENDPOINT.GET_PENDING_RIDES, {
        Authorization: `Bearer ${driver.token}`,
      });
      // console.log("Available Jobs:", response);
      setAvailableJobs(response);
    } catch (error) {
      console.error("Error fetching pending jobs:", error.message);
    }
  };
  const [totalEarningssoFar, setTotalEarningssoFar] = useState(0);
  const [TotalTripsCompleted, setTotalTripsCompleted] = useState(0);
    const GET_DRIVER_JOB_DETAILS = async () => {
    try {
      const response = await api.get(JOBENDPOINT.GET_DRIVER_JOB_DETAILS(driver?.driverId), {
        Authorization: `Bearer ${driver.token}`,
      });
      setTotalEarningssoFar(response?.totalEarnings);
      setTotalTripsCompleted(response?.completedRides);
      console.log("Today job staets Jobs:", response);
      // setAvailableJobs(response);
    } catch (error) {
      console.error("Error fetching pending jobs:", error.message);
    }
  };

  const fetchActiveJob = async () => {
    try {
      const response = await api.get(
        JOBENDPOINT.GET_DRIVER_ACTIVE_RIDE(driver?.driverId),
        {
          Authorization: `Bearer ${driver.token}`,
        }
      );
      if(response?.length === 0) {
        // setCurrentJob(null);
        return;
      }
      const job = await CreateJobObject(response[0]);
 
      checkAndSetJob(job)
    } catch (error) {
      console.error("Error fetching active job:", error.message);
    }
  };

    const checkAndSetJob = async (job) => {
  if (!job?.id) return;

  try {
    const snapshot = await database().ref(`jobs/${job.id}`).once('value');
    if (!snapshot.exists()) {
      
      setCurrentJob(job);
    } else {
    
      // console.log(`Job with id ${job.id} already exists in Firebase.`);
    }
  } catch (error) {
    console.error('Error checking job in Firebase:', error);
  }
};
      const fetchPreviousJobs = async () => {
    try {
      const response = await api.get(
        JOBENDPOINT.GET_LAST_THREE_RIDE(driver?.driverId),
        {
          Authorization: `Bearer ${driver.token}`,
        }
      );
      let totalEarnings = 0;

      response.forEach(job => {
        totalEarnings += parseFloat(job.earningsSoFar || 0);
      });
      setTotalEarnings(totalEarnings.toFixed(2)); // Set total earnings to 2 decimal places
      // console.log("Previous Jobs:", response);
      // const job = await CreateJobObject(response);
      // setCurrentJob(job);
      // console.log("responseresponseresponseresponseprevous", response);
      setMockPreviousJobs(response);
        // setAvailableJobs(response);
    } catch (error) {
      console.error("Error fetching active job:", error.message);
    }
  };
  useEffect(() => {
  let intervalId: number | null = null;

  const initialize = () => {
    if (!driver) return;
    setDriverDetails(driver);
    fetchInitialUnreadCount();
    fetchPendingJob();
    GET_DRIVER_JOB_DETAILS();
    if (!currentJob) {
       fetchActiveJob();
    }
   
    fetchPreviousJobs();
  };

  initialize();

  // Conditionally start interval
  if (shiftStarted && shiftStartTime) {
    intervalId = window.setInterval(() => {
      fetchPendingJob();
       if (!currentJob) {
         fetchActiveJob();
         
    }
   GET_DRIVER_JOB_DETAILS();
    }, 30000); // every 30 seconds
  }

  const unsubscribe = setupNewMessageListeners();

  return () => {
    // Clear interval if it was set
    if (intervalId !== null) {
      clearInterval(intervalId);
    }

    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  };
}, [userId, shiftStarted, shiftStartTime, driver]);

 
  const fetchInitialUnreadCount = async () => {
    if (userId) {
      // console.log('Fetching initial unread count for user:', userId);
      const companyId = await AsyncStorage.getItem('CompanyId') || 1;
      const onlineDriversRef = database().ref(`companies/${companyId}/onlineAgents`);
      let initialUnread = 0;

      try {
        const driversSnapshot = await onlineDriversRef.once('value');
        const driversData = driversSnapshot.val();

        if (driversData) {
          const driverIds = Object.keys(driversData).filter(id => id !== userId);

          await Promise.all(
            driverIds.map(async (driverId) => {
              const chatKey = [userId, driverId].sort().join('_');
              const chatRef = database().ref(`chat_history/${chatKey}`);
              const messagesSnapshot = await chatRef.orderByChild('timestamp').once('value');

              messagesSnapshot.forEach(messageSnap => {
                const message = messageSnap.val();
                if (message.receiverId === userId && !message.read) {
                  initialUnread++;
                }
              });
            })
          );
          setUnreadChatCount(initialUnread);
          // console.log('Initial Unread Count:', initialUnread);
        }
      } catch (error) {
        console.error('Error fetching initial unread count:', error.message);
      }
    }
  };

  const setupNewMessageListeners = () => {
    let chatListeners = [];
    const setup = async () => {
      if (userId) {
        // console.log('Setting up new message listeners for user:', userId);
        const companyId = await AsyncStorage.getItem('CompanyId') || 1;
        const onlineDriversRef = database().ref(`companies/${companyId}/onlineAgents`);

        try {
          const driversSnapshot = await onlineDriversRef.once('value');
          const driversData = driversSnapshot.val();

          if (driversData) {
            const driverIds = Object.keys(driversData).filter(id => id !== userId);

            driverIds.forEach(driverId => {
              const chatKey = [userId, driverId].sort().join('_');
              const chatRef = database().ref(`chat_history/${chatKey}`);

              const listener = chatRef.on('child_added', (messageSnapshot) => {
                const message = messageSnapshot.val();
                if (message && message.receiverId === userId && message.read == false) {
                  setUnreadChatCount(prevCount => prevCount + 1);
                  showInfoToast('New Message', message.text || 'Image');
                  if (messageSound) {
                      messageSound.release();
                    }
                }
              });
              chatListeners.push({ chatKey, listener });
            });
          }
        } catch (error) {
          console.error('Error setting up new message listeners:', error.message);
        }
      }
    };

    setup();

    return () => {
      // console.log('Cleaning up new message listeners');
      chatListeners.forEach(({ chatKey, listener }) => {
        database().ref(`chat_history/${chatKey}`).off('child_added', listener);
      });
    };
  };
const [availableJobs, setAvailableJobs] = useState([]);

  const [mockPreviousJobs, setMockPreviousJobs] = useState([]);
    const [totalEarnings, setTotalEarnings] = useState(0);
  

// --- Initial Setup and Animations ---
useEffect(() => {
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 800,
    useNativeDriver: true,
  }).start();

  // Check and start background location service if not running
  const checkLocationService = async () => {
    if (!isBackgroundServiceRunning) {
      // console.log('Location service not running, attempting to start...');
      await startService();
    }
  };
  checkLocationService();

  // Set up network listener
  const unsubscribeNetInfo = NetInfo.addEventListener(state => {
    setIsOnline(state.isConnected); // Update global online status
  });

  return () => {
    clearInterval(onlineTimer.current);
    unsubscribeNetInfo();
  };
}, [fadeAnim, isBackgroundServiceRunning, setIsOnline]);

// --- Online Time Tracking ---
useEffect(() => {
  // console.log("🟡 Online time tracking started:", shiftStarted, JSON.stringify(shiftStartTime));

  const startTracking = () => {
    if (onlineTimer.current) clearInterval(onlineTimer.current);

    onlineTimer.current = setInterval(() => {
      const now = Date.now();
      const diffSeconds = Math.floor((now - new Date(shiftStartTime).getTime()) / 1000);
      // console.log("🟢 Online time tracking:", diffSeconds, "seconds");
      setOnlineTime(diffSeconds);
    }, 1000);
  };  

  if (shiftStarted && shiftStartTime) {
    // console.log("🟢 Online time tracking started");
    startTracking();

    // 🔁 Double-push fallback: Retry tracking in 100ms if it's the first load
    setTimeout(() => {
      // if (!onlineTimer.current) {
        // console.log("🔁 Retrying interval setup...");
        startTracking();
      // }
    }, 100);
  } else {
    console.log("🟡 Online time tracking stopped");
    clearInterval(onlineTimer.current);
    onlineTimer.current = null;
    setOnlineTime(0);
  }

  return () => {
    clearInterval(onlineTimer.current);
    onlineTimer.current = null;
  };
}, [shiftStarted, shiftStartTime]);

 
const handleShiftToggle = useCallback(() => {
  LayoutAnimation.easeInEaseOut();

  if (shiftStarted) {
    showConfirmationToast({
      title: 'Confirm Shift Close',
      message: 'Are you sure you want to close your shift?',
      confirmText: 'Yes, Close Shift',
      cancelText: 'Cancel',
      onConfirm: async() => {
        // await shiftStatusChange(false);
        await shiftStatusChange(false, selectedVehicle.id, driver.driverId,driver.token, 'offboard');
        endShift();         // Clear context + AsyncStorage
        stopService();      // Stop background service
        setIsOnline(false); // Mark offline
        clearSelectedTarrif(); // Clear selected tariff
         showSuccessToast('Shift Closed', 'You have successfully closed your shift.');
      },
    });
  }  
}, [shiftStarted, endShift, setIsOnline]);

const confirmStartShift = useCallback(async () => {
  if (!tempVehiclePlate || !tempVehicleModel) {
    // Alert.alert('Missing Info', 'Please enter both vehicle plate and model.');
    showInfoToast('Missing Info', 'Please enter both vehicle plate and model.');
    return;
  }
  LayoutAnimation.easeInEaseOut(); // Animate layout changes
  startShift({ plate: tempVehiclePlate, model: tempVehicleModel }); // Start shift and save vehicle
  await startService(); // Ensure background service is running
  setIsOnline(true); // Mark online
  
  setTempVehiclePlate('');
  setTempVehicleModel('');
  Alert.alert('Shift Started', 'You are now online and ready to accept jobs!');
}, [startShift, tempVehiclePlate, tempVehicleModel, setIsOnline]);


const onRefresh = useCallback( () => {
  setRefreshing(true);
  // Simulate fetching new jobs/data
  setTimeout( async () => {
 
    await fetchPendingJob();
     if (!currentJob) {
       await fetchActiveJob();
     }
   GET_DRIVER_JOB_DETAILS();

   await fetchPreviousJobs();
    // setAvailableJobs((prev) => [newJob, ...prev]);
    
    setRefreshing(false);
    // fetchUnreadChatCount(); // Refresh chat count after fetching new jobs
    // Alert.alert('Refreshed', 'New jobs might be available!');
    showInfoToast('Refreshed', 'New jobs might be available!'); // Show toast notification
  }, 1500);
}, [availableJobs?.length]);

 
const handleAcceptJob = useCallback((job) => {
  if (!job) return;

  const pickupAddress = job?.pickupLocation?.address ?? 'Unknown Location';

  LayoutAnimation.easeInEaseOut();

  showConfirmationToast({
    title: 'Accept Job?',
    message: `PickUp Location: ${pickupAddress}`,
    confirmText: 'Accept',
    cancelText: 'Decline',
    onConfirm: async () => {
      try {
        // Create a UI-friendly job object
        const jobObject = await CreateJobObject(job);
        if (!jobObject) {
          showErrorToast('Error', 'Failed to process job details.');
          return;
        }

        // Mark the job as accepted with start time
        jobObject.status = 'accepted';
        jobObject.driver_job_start_time = new Date().toISOString();

        console.log('✅ Accepted Job:', JSON.stringify(jobObject, null, 2));

        setCurrentJob(jobObject);
        setAvailableJobs(prev => prev.filter(j => j.id !== job.id));

        showSuccessToast(
          '✅ Job Accepted',
          `You have accepted the job to ${jobObject?.dropoffLocation?.address}.`
        );

        // navigation.navigate('JobTrackingScreen', { job: jobObject });

      } catch (error) {
        console.error('Error during job acceptance:', error);
        showErrorToast('Error', 'Something went wrong while accepting the job.');
      }
    },
    onCancel: () => {
      console.log('❌ Job declined');
    },
  });
}, [setCurrentJob, setAvailableJobs, navigation]);


const handleGoToActiveJob = useCallback(() => {
  if (currentJob) {
    navigation.navigate('JobTrackingScreen', { job: currentJob });
  } else {
    // Alert.alert('No Active Job', 'You do not have an active job currently.');
    showInfoToast('No Active Job', 'You do not have an active job currently.');
  }
}, [currentJob, navigation]);

  
const CreateNewJob = async () => {
  try {
    // Step 1: Try to reverse geocode pickup address
    let displayName = 'No address found';
    try {
      const reverseGeocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=en`;
      const response = await fetch(reverseGeocodeUrl, {
        headers: {
          'User-Agent': 'YourAppName/1.0 (your@email.com)',
        },
      });

      if (response.ok) {
        const data = await response.json();
        displayName = data.display_name || displayName;
      } else {
        console.warn(`⚠️ Reverse geocode failed: ${response.status}`);
      }
    } catch (geoError) {
      console.warn('⚠️ Reverse geocoding error:', geoError.message);
    }


    if(!selectedTarrif?.id) {
      showErrorToast('Error', 'Please select a tariff before creating a job.');
      return;
    }
    // Step 2: Construct job object
    const newJobObject = {
      driverId: driver.driverId,
      riderId: driver.userId,
      pickupLocation: {
        address: displayName,
        latitude,
        longitude,
      },
      dropoffLocation: {
        address: '',
        latitude: 0,
        longitude: 0,
      },
      tariffId: selectedTarrif?.id || '0', // Default to a standard tariff
      passengerCount: 1,
      bagCount: 0,
      wheelchairCount: 0,
      wheelchairAccessNeeded: false,
      towingOption: false,
      notes: '',
      pickupTime: new Date().toISOString(),
      dropoffTime: '',
      status:'started'
    };

    console.log('🆕 New Job Object:', newJobObject);

    // Step 3: Submit job creation request
    const result = await api.post(JOBENDPOINT.CREATE_RIDE, newJobObject, {
      Authorization: `Bearer ${driver.token}`,
    });
    console.log('✅ Job created successfully:', result);
    await fetchActiveJob();
  } catch (error) {
    console.error('❌ Failed to create job:', error.message);
    showErrorToast('Job Creation Failed', error.message);
  }
};

const truncate = (text, limit = 50) => 
  text?.length > limit ? text.substring(0, limit) + '…' : text;

// --- Render Logic ---
const renderJobCard = ({ item }) => (
  <TouchableOpacity
    style={styles.jobCard}
    onPress={() => handleAcceptJob(item)} // Or view details
    activeOpacity={0.8}
  >
    <View style={styles.jobCardHeader}>
      <Icon name="map-marker-outline" size={20} color="#ADD8E6" />
      <Text style={styles.jobDestination}>{item?.dropoffLocation?.address}</Text>
      <Text style={styles.jobEarning}>{item?.fare}</Text>
      <Text style={styles.jobDetailText}> <Icon name="human-male" size={20} color="#ccc"></Icon>{ item?.passengerCount }</Text>
        <Text style={styles.jobDetailText}> <Icon name="human-wheelchair" size={20} color="#ccc"></Icon>{ item?.wheelchairCount }</Text>

      <Text style={styles.jobDetailText}> <Icon name="bag-carry-on" size={20} color="#ccc"></Icon>{ item?.bagCount }</Text>
    </View>
    <View style={styles.jobCardDetails}>
      <Text style={styles.jobDetailText}>
        <Icon name="map-marker-radius" size={14} color="#ccc" /> Pickup: {item?.pickupLocation?.address}
      </Text>
      <Text style={styles.jobDetailText}>
        <Icon name="clock-outline" size={14} color="#ccc" /> {item?.duration || 'N/A'}
      </Text>
      <Text style={styles.jobDetailText}>
        <Icon name="map-marker-distance" size={14} color="#ccc" /> {item?.distance 
        || 'N/A'}
      </Text>
    </View>
    <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptJob(item)} activeOpacity={0.7}>
      <Text style={styles.acceptButtonText}>Accept Job</Text>
      <Icon name="arrow-right" size={18} color="#fff" />
    </TouchableOpacity>
  </TouchableOpacity>
);
  const goToChat = useCallback(() => {
    setUnreadChatCount(0); // Reset unread count when navigating to chat
    navigation.navigate('ChatScreen');
  }, [navigation]);
return (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="light-content" backgroundColor="#121212" />
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.driverProfile}>
          <Icon name="account-circle" size={36} color="#FFD700" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.driverName}>{driverDetails?.userName}</Text>
            <Text style={styles.driverStatus}>
              <Icon name={shiftStarted ? "circle" : "circle-outline"} size={12} color={shiftStarted ? "#4CAF50" : "#FF5722"} />
              {shiftStarted ? ' Online' : ' Offline'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={goToChat} style={{ marginRight: 15 }}>
            <Icon name="chat-outline" size={28} color="lightgreen" />
             {unreadChatCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadChatCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShiftToggle} style={styles.shiftToggleButton} activeOpacity={0.7}>
              <Icon name={shiftStarted ? "power-off" : "power-off"} size={24} color="red" />
              <Text style={styles.shiftToggleButtonText}>
                {shiftStarted ? 'End Shift' : 'Start Shift'}
              </Text>
            </TouchableOpacity>
          </View>
        {/* <TouchableOpacity onPress={handleShiftToggle} style={styles.shiftToggleButton} activeOpacity={0.7}>
          <Icon name={shiftStarted ? "power-off" : "power"} size={24} color="#fff" />
          <Text style={styles.shiftToggleButtonText}>
            {shiftStarted ? 'End Shift' : 'Start Shift'}
          </Text>
        </TouchableOpacity> */}
      </View>
      {/* need to show the ccurent selected Tarrif info here */}
      <View>
        {isTarrifSelected && (
          <View style={styles.selectedTarrifContainer}>
            <Text style={styles.selectedTarrifText}>
              Tariff: {selectedTarrif?.name || 'Standard'}
            </Text>
            <TouchableOpacity
              style={styles.clearTarrifButton}
              onPress={clearSelectedTarrif}
            >
              <Icon name="chart-bar" size={20} color="#fff" />
              <Text style={styles.clearTarrifButtonText}>Change Tariff  </Text>
            </TouchableOpacity>
          </View>
        )}
          </View>
      
      <NetworkBanner />
       <CurrentAddress />
     
      

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFD700"
            colors={['#FFD700', '#FF5722']}
          />
        }
      >
        
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today’s Overview</Text>
           
          {!currentJob  && (
           <>
                 <TouchableOpacity style={[styles.goToJobButton, { backgroundColor: '#FF5722' }]} onPress={CreateNewJob}  >
                  <Text style={[styles.goToJobButtonText]}  >Create New JOB</Text>
                 </TouchableOpacity>
              </>
            
           )}
          <View style={styles.overviewRow}>
            
            <View style={styles.overviewItem}>
              <Icon name="cash-multiple" size={28} color="#FFD700" />
              <Text style={styles.overviewValue}>QAR {parseFloat(totalEarningssoFar).toFixed(2)}</Text>
              <Text style={styles.overviewLabel}>Earnings</Text>
            </View>
            <View style={styles.overviewItem}>
              <Icon name="check-circle-outline" size={28} color="#8BC34A" />
              <Text style={styles.overviewValue}>{TotalTripsCompleted}</Text>
              <Text style={styles.overviewLabel}>Trips</Text>
            </View>
            <View style={styles.overviewItem}>
              <Icon name="clock-outline" size={28} color="#ADD8E6" />
              <Text style={styles.overviewValue}>{formatDuration(onlineTime)} </Text>
              <Text style={styles.overviewLabel}>Online Time</Text>
            </View>
          </View>
        </View>

        {/* Active Job Card */}
        {currentJob && currentJob.status !== 'completed' && currentJob.status !== 'cancelled' ? (
          <TouchableOpacity
            style={styles.activeJobCard}
            onPress={handleGoToActiveJob}
            activeOpacity={0.8}
          >
            <View style={styles.activeJobHeader}>
              <Text style={styles.activeJobTitle}>Active Trip</Text>
              <Text style={styles.activeJobStatus}>
                <Icon name="car-side" size={16} color="#FFD700" /> {currentJob.status.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={styles.activeJobDetails}>
              <View style={styles.activeJobLocation}>
                <Icon name="map-marker-outline" size={20} color="#4CAF50" />
                <Text style={styles.activeJobLocationText}>{currentJob.pickupLocation}</Text>
              </View>
              <View style={styles.activeJobLocation}>
                <Icon name="flag-checkered" size={20} color="#FF5722" />
                <Text style={styles.activeJobLocationText}>{currentJob.dropoffLocation}</Text>
              </View>
              <View style={styles.activeJobMetrics}>
                <Text style={styles.activeJobMetricText}>
                  <Icon name="cash-multiple" size={16} color="#FFD700" /> Earnings: $ {parseFloat(currentJob.earningsSoFar || 0).toFixed(2)}
                </Text>
                <Text style={styles.activeJobMetricText}>
                  <Icon name="timer-outline" size={16} color="#ADD8E6" /> Est. Duration: {currentJob.estimatedDuration}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.goToJobButton} onPress={handleGoToActiveJob} activeOpacity={0.7}>
              <Text style={styles.goToJobButtonText}>Go to Job</Text>
              <Icon name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <View style={styles.noActiveJobCard}>
            <Text style={styles.noActiveJobText}>No active jobs. Start your shift to receive new requests!</Text>
            {!shiftStarted && (
              <TouchableOpacity style={styles.startShiftButton} onPress={handleShiftToggle} activeOpacity={0.7}>
                <Icon name="power" size={20} color="#fff" />
                <Text style={styles.startShiftButtonText}>Start Shift</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Available Jobs */}
        {shiftStarted && availableJobs?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New Job Offers</Text>
            <FlatList
              data={availableJobs}
              keyExtractor={(item) => item.id}
              renderItem={renderJobCard}
              horizontal={true} // Horizontal scroll for available jobs
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.availableJobsList}
            />
          </View>
        )}

        {/* Previous Jobs */}
        {mockPreviousJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Previous Trips</Text>
            <FlatList
              data={mockPreviousJobs}
              keyExtractor={(item) => item.id}
              scrollEnabled={false} // Disable inner scroll
              renderItem={({ item }) => (
                <View style={styles.previousJobItem}>
       
                  <View style={styles.previousJobDetails}>
                    <View style={{marginBottom: 10}}>
                         <Text style={styles.addressLabel}>📍 Pickup:</Text>
                    <Text
                      style={styles.previousJobAddress}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {truncate(item.pickupLocation?.address)}
                    </Text>
                      </View>
                    <View>
                      <Text style={styles.addressLabel}>🏁 Dropoff:</Text>
                    <Text
                      style={styles.previousJobAddress}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                       
                     {item.dropoffLocation?.address ?truncate(item.dropoffLocation?.address) : 'N/A'}   
                   
                    </Text>
                      </View>

                    {/* <Icon name="flag-checkered" size={20} color="#ADD8E6" /> */}
                    {/* <Text style={styles.previousJobDestination}> {item.pickupLocation?.address} - {item.dropoffLocatio?.address || 'N/A'}</Text> */}
                  </View>
               
                 
                  
                    <Text style={styles.previousJobDate}>
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                </View>
              )}
            />
          </View>
        )}
      </ScrollView>
    </Animated.View>

    
    
  </SafeAreaView>
);
};

const mapStyle = [
// Dark map style JSON (from previous JobTrackingScreen, kept for consistency if needed elsewhere)
{ elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
{ elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
{ elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
{
  featureType: 'administrative.locality',
  elementType: 'labels.text.fill',
  stylers: [{ color: '#d59563' }],
},
{
  featureType: 'poi',
  elementType: 'labels.text.fill',
  stylers: [{ color: '#d59563' }],
},
{
  featureType: 'poi.park',
  elementType: 'geometry',
  stylers: [{ color: '#263c3f' }],
},
{
  featureType: 'poi.park',
  elementType: 'labels.text.fill',
  stylers: [{ color: '#6b9a76' }],
},
{
  featureType: 'road',
  elementType: 'geometry',
  stylers: [{ color: '#38414e' }],
},
{
  featureType: 'road',
  elementType: 'geometry.stroke',
  stylers: [{ color: '#212a37' }],
},
{
  featureType: 'road',
  elementType: 'labels.text.fill',
  stylers: [{ color: '#9ca5b3' }],
},
{
  featureType: 'road.highway',
  elementType: 'geometry',
  stylers: [{ color: '#746855' }],
},
{
  featureType: 'road.highway',
  elementType: 'geometry.stroke',
  stylers: [{ color: '#1f2835' }],
},
{
  featureType: 'road.highway',
  elementType: 'labels.text.fill',
  stylers: [{ color: '#f3d19c' }],
},
{
  featureType: 'transit',
  elementType: 'geometry',
  stylers: [{ color: '#2f3948' }],
},
{
  featureType: 'transit.station',
  elementType: 'labels.text.fill',
  stylers: [{ color: '#d59563' }],
},
{
  featureType: 'water',
  elementType: 'geometry',
  stylers: [{ color: '#17263c' }],
},
{
  featureType: 'water',
  elementType: 'labels.text.fill',
  stylers: [{ color: '#515c6d' }],
},
{
  featureType: 'water',
  elementType: 'labels.text.stroke',
  stylers: [{ color: '#17263c' }],
},
];


const styles = StyleSheet.create({
safeArea: {
  flex: 1,
  backgroundColor: '#1a1a1a', // Dark background for the whole screen
},  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
container: {
  flex: 1,
  backgroundColor: '#1a1a1a',
  paddingTop: StatusBar.currentHeight,
},
loadingContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#1a1a1a',
},
loadingText: {
  color: '#fff',
  marginTop: 10,
  fontSize: 16,
},
header: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: SPACING_HORIZONTAL,
  paddingVertical: 15,
  backgroundColor: '#121212',
  borderBottomWidth: 1,
  borderBottomColor: '#333',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
  elevation: 8,
},
driverProfile: {
  flexDirection: 'row',
  alignItems: 'center',
},
driverName: {
  color: '#fff',
  fontSize: 18,
  fontWeight: 'bold',
},
driverStatus: {
  color: '#ccc',
  fontSize: 13,
  marginTop: 2,
},
shiftToggleButton: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#333',
  paddingHorizontal: 15,
  paddingVertical: 8,
  borderRadius: 25,
  borderWidth: 1,
  borderColor: '#555',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.4,
  shadowRadius: 3,
  elevation: 5,
},
shiftToggleButtonText: {
  color: '#fff',
  marginLeft: 8,
  fontWeight: 'bold',
  fontSize: 14,
},
currentLocationCard: {
  backgroundColor: 'rgba(25,25,25,0.9)',
  marginHorizontal: SPACING_HORIZONTAL,
  marginTop: 15,
  padding: 15,
  borderRadius: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 10,
},
currentLocationText: {
  color: '#ADD8E6',
  fontSize: 15,
  fontWeight: '600',
},
scrollContainer: {
  paddingHorizontal: SPACING_HORIZONTAL,
  paddingBottom: 20, // Add padding at the bottom of the scroll view
},
section: {
  marginTop: 25,
},
sectionTitle: {
  color: '#fff',
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 15,
},
overviewRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  flexWrap: 'wrap', // Allow items to wrap
},
overviewItem: {
  backgroundColor: 'rgba(25,25,25,0.9)',
  width: OVERVIEW_ITEM_WIDTH, // Responsive width
  paddingVertical: 15,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 10, // Spacing between rows
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
  elevation: 7,
},
overviewValue: {
  fontSize: 22,
  fontWeight: 'bold',
  color: '#FFD700',
  marginTop: 8,
},
overviewLabel: {
  fontSize: 13,
  color: '#ccc',
  marginTop: 4,
},
activeJobCard: {
  backgroundColor: 'rgba(25,25,25,0.95)',
  borderRadius: 12,
  padding: 20,
  marginTop: 25,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 15,
  elevation: 15,
  borderLeftWidth: 5,
  borderLeftColor: '#2196F3', // Blue accent
},
activeJobHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 15,
},
activeJobTitle: {
  color: '#fff',
  fontSize: 20,
  fontWeight: 'bold',
},
activeJobStatus: {
  color: '#FFD700',
  fontSize: 14,
  fontWeight: '600',
},
activeJobDetails: {
  marginBottom: 15,
},
activeJobLocation: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
  gap: 10,
},
activeJobLocationText: {
  color: '#ccc',
  fontSize: 15,
  flex: 1,
},
activeJobMetrics: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 10,
},
activeJobMetricText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
  gap: 5,
},
goToJobButton: {
  backgroundColor: '#2196F3',
  paddingVertical: 12,
  borderRadius: 30,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: 5,
  elevation: 8,
},
goToJobButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
noActiveJobCard: {
  backgroundColor: 'rgba(25,25,25,0.95)',
  borderRadius: 12,
  padding: 20,
  marginTop: 25,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 120,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 10,
  borderLeftWidth: 5,
  borderLeftColor: '#FF5722', // Red accent
},
noActiveJobText: {
  color: '#ccc',
  fontSize: 16,
  textAlign: 'center',
  marginBottom: 15,
},
startShiftButton: {
  backgroundColor: '#4CAF50',
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 30,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: 5,
  elevation: 8,
},
startShiftButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
availableJobsList: {
  paddingVertical: 5, // Add some vertical padding
},
jobCard: {
  backgroundColor: 'rgba(30,30,30,0.9)',
  borderRadius: 12,
  padding: 15,
  marginRight: 15, // Spacing between horizontal cards
  width: width * 0.75, // Make horizontal cards take up 75% of screen width
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
  elevation: 7,
  borderLeftWidth: 4,
  borderLeftColor: '#FFD700', // Gold accent
},
jobCardHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
  gap: 8,
},
jobDestination: {
  color: '#fff',
  fontSize: 17,
  fontWeight: 'bold',
  flex: 1, // Take remaining space
},
jobEarning: {
  color: '#FFD700',
  fontSize: 16,
  fontWeight: 'bold',
},
jobCardDetails: {
  marginBottom: 15,
},
jobDetailText: {
  color: '#ccc',
  fontSize: 13,
  marginBottom: 4,
  gap: 5,
},
acceptButton: {
  backgroundColor: '#4CAF50',
  paddingVertical: 10,
  borderRadius: 25,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.4,
  shadowRadius: 4,
  elevation: 6,
},
acceptButtonText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: 'bold',
},
previousJobItem: {
  backgroundColor: 'rgba(25,25,25,0.9)',
  padding: 15,
  borderRadius: 12,
  marginBottom: 10,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 5,
},
// previousJobDetails: {
//   flexDirection: 'row',
//   alignItems: 'center',
//   gap: 10,
//   flex: 1,
// },
previousJobDestination: {
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
},
previousJobEarnings: {
  color: '#FFD700',
  fontSize: 15,
  fontWeight: 'bold',
},
previousJobDate: {
  color: '#ccc',
  fontSize: 12,
  marginLeft: 10,
},
// Modal Styles
modalOverlay: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
},
modalContent: {
  backgroundColor: '#1a1a1a',
  borderRadius: 15,
  padding: 25,
  width: '85%',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.6,
  shadowRadius: 20,
  elevation: 20,
},
modalTitle: {
  color: '#fff',
  fontSize: 22,
  fontWeight: 'bold',
  marginBottom: 20,
},
modalInput: {
  width: '100%',
  backgroundColor: '#333',
  color: '#fff',
  paddingVertical: 12,
  paddingHorizontal: 15,
  borderRadius: 10,
  fontSize: 16,
  marginBottom: 15,
  borderWidth: 1,
  borderColor: '#555',
},
modalButton: {
  backgroundColor: '#4CAF50',
  paddingVertical: 14,
  paddingHorizontal: 25,
  borderRadius: 30,
  marginTop: 10,
  width: '100%',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: 5,
  elevation: 8,
},
modalButtonText: {
  color: '#fff',
  fontSize: 17,
  fontWeight: 'bold',
},
modalCancelButton: {
  marginTop: 15,
  paddingVertical: 10,
},
modalCancelButtonText: {
  color: '#FF5722',
  fontSize: 16,
  fontWeight: 'bold',
},
 selectedTarrifContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
 
    marginHorizontal: 15,
 
    marginTop: 10,

    textTransform: 'capitalize',

  },
  selectedTarrifText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  clearTarrifButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'green',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    gap: 5,
  },
  clearTarrifButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previousJobDetails: {
  flexDirection: 'column',
  marginBottom: 6,
},

previousJobAddress: {
  fontSize: 14,
  color: 'white',
},

addressLabel: {
  fontWeight: '600',
  color: '#666',
  fontSize: 12,
},

});

export default HomeScreen;
