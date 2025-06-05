import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
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
import { shiftStatusChange } from '../../utils/common';

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

const { shiftStarted, shiftStartTime, shiftCloseTime, startShift, endShift, selectedVehicle, setSelectedVehicle } = useContext(ShiftContext);
const { currentJob, setCurrentJob, setJobStatus, setIsOnline } = useJobStore();
const { isBackgroundServiceRunning } = useLocationStore();

// Animation value for fade-in effect
const fadeAnim = useRef(new Animated.Value(0)).current;

// Mock Data (replace with API calls)
const [todayEarnings, setTodayEarnings] = useState(0);
const [tripsCompletedToday, setTripsCompletedToday] = useState(0);
const [onlineTime, setOnlineTime] = useState(0); // in seconds
const onlineTimer = useRef(null);

const [availableJobs, setAvailableJobs] = useState([
  { id: 'a1', destination: 'Souq Waqif', pickup: 'Doha Corniche', earning: 'QAR 100', estimatedDuration: '15 mins', distance: '5.2 km', destinationLat: 25.274188294053577, destinationLng: 51.5455120537612, pickupLat: 25.2933, pickupLng: 51.5310 },
  { id: 'a2', destination: 'Hamad Intl Airport', pickup: 'West Bay', earning: 'QAR 140', estimatedDuration: '25 mins', distance: '12.8 km', destinationLat: 25.274188294053577, destinationLng: 51.5455120537612, pickupLat: 25.3211, pickupLng: 51.5032 },
  { id: 'a3', destination: 'Aspire Zone', pickup: 'Al Sadd', earning: 'QAR 110', estimatedDuration: '20 mins', distance: '8.5 km', destinationLat: 25.274188294053577, destinationLng: 51.5455120537612, pickupLat: 25.2900, pickupLng: 51.4800 },
]);

const mockPreviousJobs = [
  { id: 'p1', destination: 'West Bay', earnings: 'QAR 300', date: '2025-05-20', status: 'completed' },
  { id: 'p2', destination: 'The Pearl', earnings: 'QAR 150', date: '2025-05-19', status: 'completed' },
  { id: 'p3', destination: 'Lusail', earnings: 'QAR 250', date: '2025-05-18', status: 'completed' },
];
   const simulateJob = () => {
  const fakeJob = {
    id: 'JOB-2025-001',
    pickupLocation: 'City Center Mall, Doha',
    dropoffLocation: 'Education City, Al Rayyan',
    pickupLat: 25.276987,
    pickupLng: 51.520008,
    dropoffLat: 25.319860,
    dropoffLng: 51.437540,
    destination: 'Education City',
    CreatedAt: '2025-05-25T14:30:00+03:00',
    earningsSoFar: '0.00',
    pickupTime: '2025-05-25T14:30:00+03:00',
    dropoffTime: '2025-05-25T15:00:00+03:00',
    riderName: 'Ahmed Al Thani',
    riderPhone: '+974 5512 3412',
    estimatedFare:  '0.00',
    status: 'pending', // could be: pending, accepted, on_the_way, arrived, started, completed
    distance: '0.0 km',
    estimatedDuration: '25 mins',
    vehicle: {
      type: 'Sedan',
      plate: 'QAT-54321',
      color: 'White',
      model: 'Toyota Camry 2022',
    },
    pickupTime: '2025-05-25T15:00:00+03:00',
    assignedAt: '2025-05-25T14:45:00+03:00',
    notes: 'Customer has luggage. Assist if needed.',
    destinationLat: 25.319860, // Example coordinates
    destinationLng: 51.437540, // Example coordinates
    coordinateHistory: [], // Initialize with empty array
    driver_job_start_time: '2025-05-25T15:00:00+03:00',
    driver_job_end_time: null, // Will be set when job is completed
    jobOpened: false,
    navigatedToTracking: false,
    distanceTravelled: 0, // Initialize distance travelled`
  };

  const { setCurrentJob, setJobStatus , initializeJobFromFirebase  , setIsOnline} = useJobStore.getState();

  setCurrentJob(fakeJob);
  // setJobStatus(fakeJob.status); // sync store status too
};
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
      console.log('Location service not running, attempting to start...');
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
  if (shiftStarted && shiftStartTime) {
    onlineTimer.current = setInterval(() => {
      const now = Date.now();
      const diffSeconds = Math.floor((now - new Date(shiftStartTime).getTime()) / 1000);
      setOnlineTime(diffSeconds);
    }, 1000);
  } else {
    clearInterval(onlineTimer.current);
    setOnlineTime(0);
  }
  return () => clearInterval(onlineTimer.current);
}, [shiftStarted, shiftStartTime]);


// --- Action Handlers ---
const handleLogout = useCallback(async () => {
  Alert.alert('Logout', 'Are you sure you want to logout?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Logout',
      style: 'destructive',
      onPress: async () => {
        setLogoutLoading(true);
        try {
          await auth().signOut();
          stopService(); // Stop background service on logout
          endShift(); // Ensure shift is ended and cleared
          setIsOnline(false); // Mark offline on logout
        } catch (e) {
          Alert.alert('Error', 'Logout failed, please try again.');
        } finally {
          setLogoutLoading(false);
        }
      },
    },
  ]);
}, [endShift, setIsOnline]);

// const handleShiftToggle = useCallback(() => {
//   LayoutAnimation.easeInEaseOut(); // Animate layout changes

//   if (shiftStarted) {
//     // Close Shift
//     Alert.alert(
//       'Confirm Shift Close',
//       'Are you sure you want to close your shift?',
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Yes, Close Shift',
//           onPress: () => {
//             endShift(); // Clears context + AsyncStorage
//             stopService(); // Stop background service
//             setIsOnline(false); // Mark offline
//             Alert.alert('Shift Closed', 'You have successfully closed your shift.');
//           },
//         },
//       ],
//       { cancelable: true }
//     );
//   } else {
//     // Start Shift
//     setShowVehicleModal(true); // Show modal to select vehicle
//   }
// }, [shiftStarted, endShift, setIsOnline]);
const handleShiftToggle = useCallback(() => {
  LayoutAnimation.easeInEaseOut();

  if (shiftStarted) {
    showConfirmationToast({
      title: 'Confirm Shift Close',
      message: 'Are you sure you want to close your shift?',
      confirmText: 'Yes, Close Shift',
      cancelText: 'Cancel',
      onConfirm: async () => {
        
        endShift();         // Clear context + AsyncStorage
        await shiftStatusChange(false);
         
        stopService();      // Stop background service
        setIsOnline(false); // Mark offline
         showSuccessToast('Shift Closed', 'You have successfully closed your shift.');
      },
    });
  } else {
    setShowVehicleModal(true); // Show modal to select vehicle
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
  setShowVehicleModal(false);
  setTempVehiclePlate('');
  setTempVehicleModel('');
  Alert.alert('Shift Started', 'You are now online and ready to accept jobs!');
}, [startShift, tempVehiclePlate, tempVehicleModel, setIsOnline]);


const onRefresh = useCallback(() => {
  setRefreshing(true);
  // Simulate fetching new jobs/data
  setTimeout(() => {
    // Example: Add a new available job
    const newJobId = `a${availableJobs?.length + 1}`;
    const newJob = {
      id: newJobId,
      destination: `New Destination ${newJobId}`,
      pickup: `New Pickup ${newJobId}`,
      earning: `QAR ${Math.floor(Math.random() * 50) + 50}`,
      estimatedDuration: '10 mins',
      distance: '3.0 km',
      destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,
      pickupLat: 25.2933,
      pickupLng: 51.5310,
    };
    setAvailableJobs((prev) => [newJob, ...prev]);
    setRefreshing(false);
    // Alert.alert('Refreshed', 'New jobs might be available!');
    showInfoToast('Refreshed', 'New jobs might be available!'); // Show toast notification
  }, 1500);
}, [availableJobs?.length]);

// const handleAcceptJob = useCallback((job) => {
//   LayoutAnimation.easeInEaseOut();
//   Alert.alert(
//     'Accept Job?',
//     `Do you want to accept the job to ${job.destination} for ${job.earning}?`,
//     [
//       { text: 'Decline', style: 'cancel' },
//       {
//         text: 'Accept',
//         onPress: () => {
//           // In a real app, this would be an API call to accept the job
//           // For now, we'll simulate setting it as the current job
//           setCurrentJob({ ...job, status: 'accepted', driver_job_start_time: new Date().toISOString() });
//           setAvailableJobs((prev) => prev.filter((j) => j.id !== job.id));
//           Alert.alert('Job Accepted', `You have accepted the job to ${job.destination}.`);
//           navigation.navigate('JobTrackingScreen', { job: { ...job, status: 'accepted', driver_job_start_time: new Date().toISOString() } });
//         },
//       },
//     ]
//   );
// }, [setCurrentJob, setAvailableJobs, navigation]);
const handleAcceptJob = useCallback((job) => {
  LayoutAnimation.easeInEaseOut();
   showConfirmationToast({
    title: 'Accept Job?',
    message: `Do you want to accept the job to ${job.destination} for ${job.earning}?`,
    confirmText: 'Accept',
    cancelText: 'Decline',
    onConfirm: () => {
      const acceptedJob = {
        ...job,
        status: 'accepted',
        driver_job_start_time: new Date().toISOString(),
      };

      setCurrentJob(acceptedJob);
      setAvailableJobs((prev) => prev.filter((j) => j.id !== job.id));

      showSuccessToast('✅ Job Accepted', `You have accepted the job to ${job?.destination}.`);
      
      navigation.navigate('JobTrackingScreen', {
        job: acceptedJob,
      });
    },
    onCancel: () => {
      // Optional: Add any decline logic here
      console.log('Job declined');
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

// --- Render Logic ---
const renderJobCard = ({ item }) => (
  <TouchableOpacity
    style={styles.jobCard}
    onPress={() => handleAcceptJob(item)} // Or view details
    activeOpacity={0.8}
  >
    <View style={styles.jobCardHeader}>
      <Icon name="map-marker-outline" size={20} color="#ADD8E6" />
      <Text style={styles.jobDestination}>{item.destination}</Text>
      <Text style={styles.jobEarning}>{item.earning}</Text>
    </View>
    <View style={styles.jobCardDetails}>
      <Text style={styles.jobDetailText}>
        <Icon name="map-marker-radius" size={14} color="#ccc" /> Pickup: {item.pickup}
      </Text>
      <Text style={styles.jobDetailText}>
        <Icon name="clock-outline" size={14} color="#ccc" /> {item.estimatedDuration}
      </Text>
      <Text style={styles.jobDetailText}>
        <Icon name="map-marker-distance" size={14} color="#ccc" /> {item.distance}
      </Text>
    </View>
    <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptJob(item)} activeOpacity={0.7}>
      <Text style={styles.acceptButtonText}>Accept Job</Text>
      <Icon name="arrow-right" size={18} color="#fff" />
    </TouchableOpacity>
  </TouchableOpacity>
);

return (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="light-content" backgroundColor="#121212" />
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.driverProfile}>
          <Icon name="account-circle" size={36} color="#FFD700" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.driverName}>Ahmed Al Thani</Text>
            <Text style={styles.driverStatus}>
              <Icon name={shiftStarted ? "circle" : "circle-outline"} size={12} color={shiftStarted ? "#4CAF50" : "#FF5722"} />
              {shiftStarted ? ' Online' : ' Offline'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleShiftToggle} style={styles.shiftToggleButton} activeOpacity={0.7}>
          <Icon name={shiftStarted ? "power-off" : "power"} size={24} color="#fff" />
          <Text style={styles.shiftToggleButtonText}>
            {shiftStarted ? 'End Shift' : 'Start Shift'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Network Status */}
      <NetworkBanner />
     
      {/* Current Location */}
      {/* <View style={styles.currentLocationCard}> */}
        {/* <Icon name="crosshairs-gps" size={24} color="#ADD8E6" /> */}
        {/* <Text style={styles.currentLocationText}>Your Current Location:</Text> */}
        <CurrentAddress />
        {/* <LocationDisplay /> */}
      {/* </View> */}

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
        {/* Today's Overview */}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today’s Overview</Text>
           <TouchableOpacity   onPress={simulateJob}  >
        <Text style={styles.sectionTitle} >Fake Jobe</Text>
      </TouchableOpacity>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Icon name="cash-multiple" size={28} color="#FFD700" />
              <Text style={styles.overviewValue}>QAR {parseFloat(todayEarnings).toFixed(2)}</Text>
              <Text style={styles.overviewLabel}>Earnings</Text>
            </View>
            <View style={styles.overviewItem}>
              <Icon name="check-circle-outline" size={28} color="#8BC34A" />
              <Text style={styles.overviewValue}>{tripsCompletedToday}</Text>
              <Text style={styles.overviewLabel}>Trips</Text>
            </View>
            <View style={styles.overviewItem}>
              <Icon name="clock-outline" size={28} color="#ADD8E6" />
              <Text style={styles.overviewValue}>{formatDuration(onlineTime)}</Text>
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
                    <Icon name="flag-checkered" size={20} color="#ADD8E6" />
                    <Text style={styles.previousJobDestination}>{item.destination}</Text>
                  </View>
                  <Text style={styles.previousJobEarnings}>{item.earnings}</Text>
                  <Text style={styles.previousJobDate}>{item.date}</Text>
                </View>
              )}
            />
          </View>
        )}
      </ScrollView>
    </Animated.View>

    {/* Vehicle Selection Modal */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={showVehicleModal}
      onRequestClose={() => setShowVehicleModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Enter Vehicle Details</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Vehicle Plate Number (e.g., QAT-12345)"
            placeholderTextColor="#888"
            value={tempVehiclePlate}
            onChangeText={setTempVehiclePlate}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Vehicle Model (e.g., Toyota Camry 2023)"
            placeholderTextColor="#888"
            value={tempVehicleModel}
            onChangeText={setTempVehicleModel}
          />
          <TouchableOpacity style={styles.modalButton} onPress={confirmStartShift}>
            <Text style={styles.modalButtonText}>Confirm & Start Shift</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowVehicleModal(false)}>
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
previousJobDetails: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  flex: 1,
},
previousJobDestination: {
  color: '#fff',
  fontSize: 16,
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
});

export default HomeScreen;
