import React, { useEffect, useState, useMemo, useRef, useCallback  , useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions, // For responsiveness
  Animated,   // For animations
  LayoutAnimation, // For subtle layout changes
  UIManager, // For LayoutAnimation on Android
  ActivityIndicator
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showConfirmationToast,
} from '../../../utils/showToast'; // Adjust path as needed

 
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions'; // Import MapViewDirections
import { useNavigation } from '@react-navigation/native';
import useJobStore from '../../../store/jobStore';
import useLocationStore from '../../../store/locationStore';
import haversine from 'haversine-distance';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Using MaterialCommunityIcons for icons
import { changeRideStatus, shiftStatusChange } from  '../../../utils/common';
import { ShiftContext } from '../../../context/ShiftContext';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Get screen dimensions for responsiveness
const { width, height } = Dimensions.get('window');
const SPACING = width * 0.05; // 5% of screen width for general spacing
const MAP_HEIGHT = height * 0.35; // 35% of screen height for the map

// Ensure you have a Google Maps API Key for MapViewDirections
const GOOGLE_MAPS_APIKEY = 'AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA'; // <<< IMPORTANT: Replace with your actual API Key

const AcceptJobScreen = () => {
  const navigation = useNavigation();
  const { currentJob, setJobStatus, jobStatus, clearJob, updateCurrentJob , changeJobStatus } = useJobStore();
const { driver, selectedVehicle } = useContext(ShiftContext);

  // console.log("jobStatus" , jobStatus);
  const { latitude, longitude } = useLocationStore();
  const [counter, setCounter] = useState(30);
  const mapRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current; // For fade-in animation

  // --- Initial Setup and Animations ---
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Start countdown timer for 'pending' status
    if (jobStatus === 'pending') {
      countdownTimerRef.current = setInterval(() => {
        setCounter((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleReject(true); // Auto reject on timeout
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownTimerRef.current); // Clear timer if not pending
    }


    return () => clearInterval(countdownTimerRef.current); // Cleanup timer on unmount
  }, [fadeAnim, jobStatus]); // Depend on fadeAnim to start animation, and jobStatus to control timer

  // --- Map Fitting Logic ---
  useEffect(() => {
    if (!currentJob || !latitude || !longitude || !mapRef.current) return;

    // Use a timeout to ensure map is rendered before fitting to coordinates
    const mapFitTimeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [
          { latitude, longitude }, // Driver's current location
          { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng } // Pickup location
        ],
        {
          edgePadding: { top: 100, right: 50, bottom: 50, left: 50 }, // More padding for better view
          animated: true,
        }
      );
    }, 1000); // Give map a bit more time to render

    return () => clearTimeout(mapFitTimeout);
  }, [currentJob, latitude, longitude]); // Re-fit map if job or location changes

  // --- Action Handlers ---
  const handleAccept = useCallback(async () => {
    LayoutAnimation.easeInEaseOut(); // Animate layout changes
    clearInterval(countdownTimerRef.current); // Stop countdown
    setJobStatus('on_the_way');
    const acceptedTime = new Date().toISOString();
    updateCurrentJob({ acceptedTime, status: 'on_the_way' });
    // Alert.alert('✅ Job Accepted', 'You are now on the way to pickup!');
    showSuccessToast('Job Accepted', 'You have accepted the job and are on your way to the pickup location.');
    await changeRideStatus('accepted', currentJob?.id, driver.driverId, driver.token);

  }, [setJobStatus, updateCurrentJob]);

  const handleOnTheWay = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('arrived_ready');
    const onTheWayTime = new Date().toISOString();
    updateCurrentJob({ on_the_way_time: onTheWayTime, status: 'arrived_ready' }); // Corrected status to 'arrived_ready'
    // Alert.alert('Status Updated', 'You are marked as "On the Way".');
    showSuccessToast('On the Way', 'You are now on the way to the pickup location.');
     await changeRideStatus('on_the_way', currentJob?.id, driver.driverId, driver.token);
  }, [setJobStatus, updateCurrentJob]);

  const handleArrived = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('arrived');
    const arrivedTime = new Date().toISOString();
    updateCurrentJob({ arrivedTime, status: 'arrived' });
    // Alert.alert('Status Updated', 'You have arrived at the pickup location.');
    showSuccessToast('Arrived', 'You have arrived at the pickup location. Please confirm with the rider.');
    await changeRideStatus('arrived', currentJob?.id, driver.driverId, driver.token);
  }, [setJobStatus, updateCurrentJob]);

  const handleOnStart = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('started');
    const startedTime = new Date().toISOString();
    updateCurrentJob({ driver_job_start_time: startedTime, status: 'started' });
    setJobStatus('started');
    // Alert.alert('Ride Started', 'Enjoy the trip!');
     showSuccessToast('Ride Started', 'You have started the ride. Safe travels!');
    navigation.navigate('JobTrackingScreen', { job: currentJob });
     await changeRideStatus('started', currentJob?.id, driver.driverId, driver.token);
  }, [setJobStatus, updateCurrentJob, navigation, currentJob]);

  const handleReject = useCallback(async (auto = false) => {
    LayoutAnimation.easeInEaseOut();
    clearInterval(countdownTimerRef.current); // Stop countdown
    if (!auto) {
      // Alert.alert('❌ Job Rejected', 'You rejected the job.');
           showErrorToast('Job Rejected', 'You have rejected the job. It will be offered to another driver.');
        
    } else {
      // Alert.alert('⏱️ Timed Out', 'You didn’t respond in time. Job rejected.');
      showErrorToast('Job Rejected', 'You did not respond in time. The job has been automatically rejected.');
    }
    setJobStatus('rejected'); // Set status to rejected
    await changeRideStatus('rejected', currentJob?.id, driver.driverId, driver.token);
    updateCurrentJob({ rejectedTime: new Date().toISOString(), status: 'rejected' }); // Update job in store
    clearJob(); // Clear current job from store
    // navigation.navigate('Home'); // Navigate back to Home
  }, [clearJob, navigation, setJobStatus, updateCurrentJob ]);

  // --- Distance Check for "Arrived" Button ---
  const isNearby = useMemo(() => {
    if (!latitude || !longitude || !currentJob?.pickupLat || !currentJob?.pickupLng) return false;
    const distance = haversine(
      { latitude, longitude },
      { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng }
    ); // in meters
    const PROXIMITY_THRESHOLD = 20000999; // meters (e.g., within 200m of pickup)
    return distance <= PROXIMITY_THRESHOLD;
  }, [latitude, longitude, currentJob?.pickupLat, currentJob?.pickupLng]);

  // Render nothing if job data or location is missing
  if (!currentJob || !currentJob.id || latitude === null || longitude === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5722" />
        <Text style={styles.loadingText}>Waiting for new job or GPS signal...</Text>
      </View>
    );
  }

  const driverCoords = { latitude, longitude };
  const pickupCoords = { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng };
  const dropoffCoords = { latitude: currentJob.dropoffLat, longitude: currentJob.dropoffLng };

  const formatCurrency = (amount) => `QAR ${parseFloat(amount).toFixed(2)}`;

  return (
    <Animated.ScrollView contentContainerStyle={styles.container} style={{ opacity: fadeAnim }}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Header with Title and Countdown */}
      <View style={styles.header}>
        <Text style={styles.title}>🚖 New Ride Request</Text>
        {jobStatus === 'pending' && (
          <View style={styles.countdownContainer}>
            <Icon name="timer-sand" size={20} color="#FFD700" />
            <Text style={styles.counterText}>Auto reject in {counter}s</Text>
          </View>
        )}
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: driverCoords.latitude,
            longitude: driverCoords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={false} // Use custom marker for driver
          customMapStyle={mapStyle} // Apply dark map style
        >
          {/* Driver Location Marker */}
          <Marker
            coordinate={driverCoords}
            title="Your Location"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Icon name="car-side" size={28} color="#2196F3" />
            </View>
          </Marker>

          {/* Pickup Marker */}
          <Marker
            coordinate={pickupCoords}
            title="Pickup Location"
            description={currentJob.pickupLocation}
            pinColor="green"
          >
            <Icon name="map-marker-radius" size={30} color="#4CAF50" />
          </Marker>

          {/* Route from Driver to Pickup */}
          {/* <MapViewDirections
            origin={driverCoords}
            destination={pickupCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#4CAF50" // Green for pickup route
            lineDashpattern={[10, 5]} // Dashed line
            onReady={(result) => {
              // Optionally update ETA/distance based on Google Directions API
              // console.log(`Route Distance: ${result.distance} km`);
              // console.log(`Route Duration: ${result.duration} mins`);
            }}
            onError={(errorMessage) => {
              console.error('MapViewDirections Error:', errorMessage);
              Alert.alert('Map Error', 'Could not load directions. Check API key or network.');
            }}
          /> */}
        </MapView>
      </View>
 {/* Dynamic Action Buttons */}
      <View style={styles.buttonContainer}>
        {jobStatus === 'pending' || jobStatus == 'accepted' && (
          <>
            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept} activeOpacity={0.7}>
              <Icon name="check-circle-outline" size={24} color="#fff" />
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={async () => {
                  await changeRideStatus('rejected', currentJob?.id, driver.driverId, driver.token);
                 handleReject(false)
               // Update job status in backend
            }} activeOpacity={0.7}>
              <Icon name="close-circle-outline" size={24} color="#fff" />
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}

        {jobStatus === 'on_the_way' && (
          <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={handleOnTheWay} activeOpacity={0.7}>
            <Icon name="car-side" size={24} color="#fff" />
            <Text style={styles.btnText}>On the Way</Text>
          </TouchableOpacity>
        )}

        {jobStatus === 'arrived_ready' && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.primaryBtn,
              !isNearby && styles.disabledBtn // Apply disabled style if not nearby
            ]}
            onPress={handleArrived}
            disabled={!isNearby} // Disable button if not nearby
            activeOpacity={0.7}
          >
            <Icon name="map-marker-check" size={24} color={!isNearby ? '#888' : '#fff'} />
            <Text style={[styles.btnText, !isNearby && styles.disabledText]}>
              Arrived {isNearby ? '' : `(${Math.round(haversine(driverCoords, pickupCoords))}m)`}
            </Text>
          </TouchableOpacity>
        )}

        {jobStatus === 'arrived' && (
          <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={handleOnStart} activeOpacity={0.7}>
            <Icon name="play-circle-outline" size={24} color="#fff" />
            <Text style={styles.btnText}>Start Ride</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Job Details Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Trip Details</Text>
          <Text style={styles.fareValue}>{formatCurrency(currentJob.estimatedFare)}</Text>
        </View>

        <LabelValue icon="map-marker-outline" label="Pickup" value={currentJob.pickupLocation} color="#4CAF50" />
        <LabelValue icon="flag-checkered" label="Dropoff" value={currentJob.dropoffLocation} color="#FF5722" />

        <View style={styles.rowMetrics}>
          <Badge icon="map-marker-distance" text={`Distance: ${currentJob.distance}`} />
          <Badge icon="clock-outline" text={`ETA: ${currentJob.estimatedDuration}`} />
        </View>

        <View style={styles.divider} />

        <LabelValue icon="account-circle" label="Rider" value={currentJob.riderName} />
        <LabelValue icon="phone" label="Contact" value={currentJob.riderPhone} />
        <LabelValue icon="car" label="Vehicle" value={`${currentJob.vehicle.model} (${currentJob.vehicle.plate})`} />

        {currentJob.notes && (
          <View style={styles.notesSection}>
            <Icon name="note-text-outline" size={20} color="#FFD700" />
            <Text style={styles.notesText}>{currentJob.notes}</Text>
          </View>
        )}
      </View>

     
    </Animated.ScrollView>
  );
};

// Helper Components for cleaner rendering
const LabelValue = ({ icon, label, value, color }) => (
  <View style={styles.sectionItem}>
    <Icon name={icon} size={20} color={color || '#ADD8E6'} />
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  </View>
);

const Badge = ({ icon, text }) => (
  <View style={styles.badgeContainer}>
    <Icon name={icon} size={16} color="#ADD8E6" />
    <Text style={styles.badgeText}>{text}</Text>
  </View>
);

export default AcceptJobScreen;

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
  container: {
    marginTop: StatusBar.currentHeight || 0, // Adjust for status bar height
    flexGrow: 1,
    backgroundColor: '#1a1a1a', // Dark background
    paddingBottom: SPACING,
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
    paddingHorizontal: SPACING, // Use consistent spacing
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#fff',
    flex: 1, // Allow title to take space
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)', // Gold transparent background
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginLeft: 10,
  },
  counterText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    marginHorizontal: SPACING,
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: SPACING,
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 15,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  driverMarker: {
    backgroundColor: 'rgba(33,150,243,0.2)', // Blue transparent background
    padding: 8,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#2196F3', // Solid blue border
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  card: {
    backgroundColor: 'rgba(25,25,25,0.95)',
    borderRadius: 15,
    padding: SPACING,
    marginHorizontal: SPACING,
    marginTop: SPACING,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
    borderLeftWidth: 5,
    borderLeftColor: '#FFD700', // Gold accent
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  fareValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
    width: 70, // Fixed width for labels for alignment
  },
  value: {
    fontSize: 16,
    color: '#fff',
    flex: 1, // Allow value text to wrap
  },
  rowMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(50,50,50,0.5)',
    borderRadius: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(173,216,230,0.1)', // Light blue transparent
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: '#ADD8E6',
  },
  badgeText: {
    fontSize: 13,
    color: '#ADD8E6',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 15,
  },
  notesSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 15,
    padding: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
    gap: 10,
  },
  notesText: {
    color: '#FFD700',
    fontSize: 14,
    fontStyle: 'italic',
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 30,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
    gap: 10,
  },
  acceptBtn: {
    backgroundColor: '#4CAF50', // Green
  },
  rejectBtn: {
    backgroundColor: '#FF5722', // Red
  },
  primaryBtn: {
    backgroundColor: '#2196F3', // Blue
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  disabledBtn: {
    backgroundColor: '#607D8B', // Grey-blue
    opacity: 0.7,
  },
  disabledText: {
    color: '#bbb',
  },
});

// // Dark map style JSON (reused from JobTrackingScreen for consistency)
// const mapStyle = [
//   { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
//   { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
//   { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
//   {
//     featureType: 'administrative.locality',
//     elementType: 'labels.text.fill',
//     stylers: [{ color: '#d59563' }],
//   },
//   {
//     featureType: 'poi',
//     elementType: 'labels.text.fill',
//     stylers: [{ color: '#d59563' }],
//   },
//   {
//     featureType: 'poi.park',
//     elementType: 'geometry',
//     stylers: [{ color: '#263c3f' }],
//   },
//   {
//     featureType: 'poi.park',
//     elementType: 'labels.text.fill',
//     stylers: [{ color: '#6b9a76' }],
//   },
//   {
//     featureType: 'road',
//     elementType: 'geometry',
//     stylers: [{ color: '#38414e' }],
//   },
//   {
//     featureType: 'road',
//     elementType: 'geometry.stroke',
//     stylers: [{ color: '#212a37' }],
//   },
//   {
//     featureType: 'road',
//     elementType: 'labels.text.fill',
//     stylers: [{ color: '#9ca5b3' }],
//   },
//   {
//     featureType: 'road.highway',
//     elementType: 'geometry',
//     stylers: [{ color: '#746855' }],
//   },
//   {
//     featureType: 'road.highway',
//     elementType: 'geometry.stroke',
//     stylers: [{ color: '#1f2835' }],
//   },
//   {
//     featureType: 'road.highway',
//     elementType: 'labels.text.fill',
//     stylers: [{ color: '#f3d19c' }],
//   },
//   {
//     featureType: 'transit',
//     elementType: 'geometry',
//     stylers: [{ color: '#2f3948' }],
//   },
//   {
//     featureType: 'transit.station',
//     elementType: 'labels.text.fill',
//     stylers: [{ color: '#d59563' }],
//   },
//   {
//     featureType: 'water',
//     elementType: 'geometry',
//     stylers: [{ color: '#17263c' }],
//   },
//   {
//     featureType: 'water',
//     elementType: 'labels.text.fill',
//     stylers: [{ color: '#515c6d' }],
//   },
//   {
//     featureType: 'water',
//     elementType: 'labels.text.stroke',
//     stylers: [{ color: '#17263c' }],
//   },
// ];
