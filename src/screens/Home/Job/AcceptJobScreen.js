import React, { useEffect, useState, useMemo, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
  Platform,
  Linking, // <-- NEW: Import Linking for phone calls
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import Toast from 'react-native-toast-message';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showConfirmationToast,
} from '../../../utils/showToast';

import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import useJobStore from '../../../store/jobStore';
import useLocationStore from '../../../store/locationStore';
import haversine from 'haversine-distance';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { changeRideStatus, shiftStatusChange } from '../../../utils/common';
import { ShiftContext } from '../../../context/ShiftContext';

// Enable LayoutAnimation for Android for smooth state transitions
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// --- Responsive Design & Theming Constants ---
const { width, height } = Dimensions.get('window');
const SPACING = width * 0.035; // Fine-tuned base spacing for compactness

// Professional Dark Theme Palette
const COLOR_BACKGROUND = '#121212'; // Deep background
const COLOR_SURFACE = '#1E1E1E'; // Card/elevated surface background
const COLOR_ACCENT_PRIMARY = '#007AFF'; // Google-like Blue for primary actions/highlights
const COLOR_ACCENT_SECONDARY = '#4CAF50'; // Green for success/positive indicators
const COLOR_TEXT_PRIMARY = '#E0E0E0'; // Light grey for main text
const COLOR_TEXT_SECONDARY = '#95A5A6'; // Muted grey for labels/hints
const COLOR_WARNING = '#FFD700'; // Gold for warnings/countdown
const COLOR_ERROR = '#FF6347'; // Red for errors

// --- OpenStreetMap Tile URL ---
// Removed Markdown link syntax to fix MalformedURLException
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// --- Helper Functions ---
const formatCurrencyNZD = (amount) => {
  const value = parseFloat(amount);
  if (isNaN(value)) return 'NZD0.00';
  return `NZD${value.toFixed(2)}`;
};

const formatDistanceKm = (distanceMeters) => {
  const value = parseFloat(distanceMeters) / 1000; // Convert meters to km
  if (isNaN(value)) return '0.0 Km';
  return `${value.toFixed(1)} Km`;
};

// --- Reusable UI Components for Professionalism ---

// Label-Value Pair for details sections
const LabelValue = React.memo(({ icon, label, value, color, iconSize = 16, valueStyle = {}, children }) => ( // <-- NEW: Added children prop
  <View style={styles.sectionItem}>
    {icon && <Icon name={icon} size={iconSize} color={color || COLOR_TEXT_SECONDARY} style={styles.itemIcon} />}
    <View style={styles.labelValueContent}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueStyle]}>{value || 'N/A'}</Text>
      {children} {/* <-- NEW: Render children here */}
    </View>
  </View>
));

// Section Header with Icon
const SectionHeader = React.memo(({ title, icon }) => (
  <View style={styles.fareContainer}>
    {icon && <Icon name={icon} size={18} color={COLOR_ACCENT_SECONDARY} style={styles.fareValue} />}
    <Text style={styles.fareLabel}>{title}</Text>
  </View>
   
));

// Metric Badge (for Distance, ETA)
const MetricBadge = React.memo(({ icon, text }) => (
  <View style={styles.badgeContainer}>
    <Icon name={icon} size={15} color={COLOR_TEXT_PRIMARY} />
    <Text style={styles.badgeText}>{text}</Text>
  </View>
));


const AcceptJobScreen = () => {
  const navigation = useNavigation();
  const { currentJob, setJobStatus, jobStatus, clearJob, updateCurrentJob } = useJobStore();
  const { driver } = useContext(ShiftContext);
 
  const { latitude, longitude } = useLocationStore();
  const [counter, setCounter] = useState(30); // Countdown timer
  const [callInitiated, setCallInitiated] = useState(false); // <-- NEW: State to track if call was initiated
  const mapRef = useRef(null); // Ref for MapView
  const countdownTimerRef = useRef(null); // Ref for countdown interval
  const fadeAnim = useRef(new Animated.Value(0)).current; // For screen fade-in

  // --- Initial Setup and Animations ---
  useEffect(() => {
    // Fade-in animation for the screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600, // Faster fade-in
      useNativeDriver: true,
    }).start();

    // Setup countdown timer for 'pending' job status
    if (jobStatus === 'pending' || jobStatus === 'sending' || jobStatus === 'displayed') {
      countdownTimerRef.current = setInterval(() => {
        setCounter((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleReject(true); // Auto reject on timeout
            // clearJob();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownTimerRef.current); // Clear timer if job status is not pending
    }

    // Cleanup timer on component unmount
    return () => clearInterval(countdownTimerRef.current);
  }, [fadeAnim, jobStatus, currentJob, handleReject]);

  // --- Map Fitting Logic ---
  useEffect(() => {
    if (!currentJob?.id || !latitude || !longitude || !mapRef.current) return;

    // Coordinates to fit: driver's current location, pickup, and potentially dropoff
    const coordinatesToFit = [
      { latitude, longitude },
      { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng }
    ];

    // Include dropoff location if available and not pending status
    if (currentJob.dropoffLat && currentJob.dropoffLng && jobStatus !== 'pending') {
      coordinatesToFit.push({ latitude: currentJob.dropoffLat, longitude: currentJob.dropoffLng });
    }

    // Use a timeout to ensure map is fully rendered before animating
    const mapFitTimeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        coordinatesToFit,
        {
          edgePadding: { top: 100, right: 50, bottom: 50, left: 50 }, // Padding around markers
          animated: true, // Smooth animation
        }
      );
    }, 1000); // Small delay

    return () => clearTimeout(mapFitTimeout); // Cleanup timeout
  }, [currentJob, latitude, longitude, jobStatus]); // Re-run effect if these change

  // --- Action Handlers (Optimized with useCallback) ---

  const handleAccept = useCallback(async () => {
    LayoutAnimation.easeInEaseOut(); // Smooth layout changes
    clearInterval(countdownTimerRef.current); // Stop countdown
    setJobStatus('accepted'); // Update local job status
    const acceptedTime = new Date().toISOString();
    updateCurrentJob({ acceptedTime, status: 'accepted' } , 'handleAccept'); // Update job in store
    showSuccessToast('Job Accepted', 'Proceed to pickup location.'); // User feedback
    await changeRideStatus('accepted', currentJob?.id, driver?.driverId, driver?.token, currentJob); // API call
  }, [setJobStatus, updateCurrentJob, currentJob, driver]);

  const handleOnTheWay = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('on_the_way'); // Change from 'arrived_ready' (previous was 'on_the_way')
    const onTheWayTime = new Date().toISOString();
    updateCurrentJob({ on_the_way_time: onTheWayTime, status: 'on_the_way' } , 'handleOnTheWay'); // Ensure consistency
    showSuccessToast('Status Updated', 'You are marked as "On the Way".');
    await changeRideStatus('on_the_way', currentJob?.id, driver?.driverId, driver?.token, currentJob);
  }, [setJobStatus, updateCurrentJob, currentJob, driver]);


  const handleArrived = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('arrived'); // Mark as 'arrived'
    const arrivedTime = new Date().toISOString();
    updateCurrentJob({ arrivedTime, status: 'arrived' }  , 'handleArrived'); // Update job in store
    showSuccessToast('Arrived', 'Please confirm with the rider.');
    await changeRideStatus('arrived', currentJob?.id, driver?.driverId, driver?.token, currentJob);
  }, [setJobStatus, updateCurrentJob, currentJob, driver]);

  const handleOnStart = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('started'); // Mark job as 'started'
    const startedTime = new Date().toISOString();
    updateCurrentJob({ driver_job_start_time: startedTime, status: 'started' } , 'handleOnStart'); // Update job in store
    showSuccessToast('Ride Started', 'Safe travels!');
    // navigation.navigate('JobTrackingScreen', { job: currentJob }); // Navigate to tracking screen
    await changeRideStatus('started', currentJob?.id, driver?.driverId, driver?.token, currentJob);
  }, [setJobStatus, updateCurrentJob, navigation, currentJob, driver]);

  const handleReject = useCallback(async (auto = false) => {
    LayoutAnimation.easeInEaseOut();

    await changeRideStatus('rejected', currentJob?.id, driver?.driverId, driver?.token, currentJob); // API call
    clearInterval(countdownTimerRef.current); // Stop countdown
    if (!auto) {
      showErrorToast('Job Rejected', 'You have rejected the job.');
    } else {
      showErrorToast('Job Rejected', 'Job automatically rejected due to timeout.');
    }
    setJobStatus('rejected'); // Update local status

     updateCurrentJob({ rejectedTime: new Date().toISOString(), status: 'rejected' } , 'handleReject'); // Update job in store
     updateCurrentJob({ currentJob : null , status: 'pending' } , 'handleRejectEmpty'); // Update job in store
     clearJob(); // Clear current job
    // Navigation back to Home should be handled by a higher-level state listener
  }, [clearJob, setJobStatus, updateCurrentJob, currentJob, driver]);

  // NEW: Handler for initiating a call to the rider
  const handleCallRider = useCallback(() => {
    if (currentJob?.riderPhone) {
      Linking.openURL(`tel:${currentJob.riderPhone}`)
        .then(() => {
          setCallInitiated(true); // Mark that a call was initiated
          showInfoToast('Calling Rider', `Dialing ${currentJob.riderPhone}`);
        })
        .catch((err) => {
          console.error("Failed to make call:", err);
          showErrorToast('Call Failed', 'Could not initiate call.');
        });
    } else {
      showErrorToast('Call Failed', 'Rider phone number not available.');
    }
  }, [currentJob?.riderPhone]);

  // NEW: Handler for "Recall" action
  const handleRecall = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('recalled'); // Update local status
    updateCurrentJob({ status: 'recalled' }  , 'handleRecall'); // Update job in store
    updateCurrentJob({ currentJob : null , status: 'pending' } , 'handleRecallEmpty'); // Update job in store

    showSuccessToast('Rider Recalled', 'Job status updated to "Recalled".');
    await changeRideStatus('recalled', currentJob?.id, driver?.driverId, driver?.token, currentJob); // API call
    clearJob(); // Assuming 'recalled' also clears the job from the current screen
  }, [setJobStatus, updateCurrentJob, currentJob, driver, clearJob]);

  // NEW: Handler for "No Show" action
  const handleNoShow = useCallback(async () => {
    LayoutAnimation.easeInEaseOut();
    setJobStatus('noShow'); // Update local status
    updateCurrentJob({ status: 'noShow' } , 'handleNoShow'); // Update job in store
    showErrorToast('No Show', 'Job status updated to "No Show".');
    await changeRideStatus('noShow', currentJob?.id, driver?.driverId, driver?.token, currentJob); // API call
    clearJob(); // Clear the job from the current screen
  }, [setJobStatus, updateCurrentJob, currentJob, driver, clearJob]);


  // --- Distance Check for "Arrived" Button ---
  const isNearby = useMemo(() => {
    if (!latitude || !longitude || !currentJob?.pickupLat || !currentJob?.pickupLng) return false;
    const distance = haversine(
      { latitude, longitude },
      { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng }
    ); // Distance in meters
    const PROXIMITY_THRESHOLD = 1500000; // meters (e.g., within 1.5km of pickup, adjust as needed)
    return distance <= PROXIMITY_THRESHOLD;
  }, [latitude, longitude, currentJob?.pickupLat, currentJob?.pickupLng]);


  // --- Render nothing if job data or location is missing ---
  if (!currentJob?.id || latitude === null || longitude === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLOR_WARNING} />
        <Text style={styles.loadingText}>Waiting for new ride request or GPS signal...</Text>
      </View>
    );
  }

  // Define coordinates for markers and polylines
  const driverCoords = { latitude, longitude };
  const pickupCoords = {
    latitude: currentJob.pickupLat,
    longitude: currentJob.pickupLng
  };
  const dropoffCoords = {
    latitude: currentJob.dropoffLat,
    longitude: currentJob.dropoffLng
  };

  // Determine if call button should be visible
  const showCallButton = ['accepted', 'on_the_way', 'arrived_ready', 'arrived'].includes(jobStatus);

  return (
    <Animated.ScrollView contentContainerStyle={styles.container} style={{ opacity: fadeAnim }}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR_BACKGROUND} />

      {/* --- Header with Title and Countdown --- */}
      <View style={styles.header}>
        <Text style={styles.title}>🚖 New Ride Request</Text>
        {jobStatus == 'pending' || jobStatus == 'sending' || jobStatus == 'displayed' && (
          <View style={styles.countdownContainer}>
            <Icon name="timer-sand" size={16} color={COLOR_WARNING} />
            <Text style={styles.counterText}>Auto reject in {counter}s</Text>
          </View>
        )}
      </View>

      {/* --- Map View Section --- */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: driverCoords.latitude,
            longitude: driverCoords.longitude,
            latitudeDelta: 0.01, // Tighter zoom for initial display
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          pitchEnabled={true}
          zoomEnabled
          scrollEnabled
          rotateEnabled
          showsCompass={false}
          showsMyLocationButton={false}
          showsTraffic={false}
          showsScale={false}
          showsIndoors={false}
          showsIndoorLevelPicker={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
        >
          {/* OpenStreetMap Tile Layer */}
          <UrlTile
            urlTemplate={OSM_TILE_URL}
            maximumZ={19}
            zIndex={-1} // Render tiles below other map elements
          />

          {/* Driver Location Marker (Blue Car Icon) */}
          <Marker
            coordinate={driverCoords}
            title="Your Location"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Icon name="car-side" size={24} color={COLOR_ACCENT_PRIMARY} />
            </View>
          </Marker>

          {/* Pickup Marker (Green Map Pin) */}
          <Marker
            coordinate={pickupCoords}
            title="Pickup Location"
            description={currentJob.pickupLocation}
          >
            <Icon name="map-marker-radius" size={28} color={COLOR_ACCENT_SECONDARY} />
          </Marker>

          {/* Dropoff Marker (Red Flag, only visible after accepting) */}
          {jobStatus !== 'pending' && currentJob.dropoffLat && currentJob.dropoffLng && (
            <Marker
              coordinate={dropoffCoords}
              title="Dropoff Location"
              description={currentJob.dropoffLocation}
            >
              <Icon name="flag-checkered" size={28} color={COLOR_ERROR} />
            </Marker>
          )}

          {/* Polyline: Driver to Pickup (Gold, dashed) */}
          {(jobStatus === 'pending' || jobStatus === 'accepted' || jobStatus === 'on_the_way' || jobStatus === 'arrived_ready' || jobStatus === 'arrived' || jobStatus === 'recalled') && ( // <-- Added 'recalled' to polyline condition
            <Polyline
              coordinates={[driverCoords, pickupCoords]} // Direct line, not actual route
              strokeColor={COLOR_WARNING} // Gold for pending/pickup route
              strokeWidth={3}
              lineDashPattern={[10, 10]} // Dashed line
            />
          )}

          {/* Polyline: Pickup to Dropoff (Blue, solid, once started) */}
          {jobStatus === 'started' && currentJob.dropoffLat && currentJob.dropoffLng && (
            <Polyline
              coordinates={[pickupCoords, dropoffCoords]} // Direct line, not actual route
              strokeColor={COLOR_ACCENT_PRIMARY} // Blue for active ride route
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      </View>

      {/* --- Action Buttons (Dynamic based on Job Status) --- */}
      <View style={styles.buttonContainer}>
        {jobStatus === 'pending' || jobStatus == 'sending' || jobStatus === 'displayed' && (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={handleAccept} activeOpacity={0.7}>
              <LinearGradient
                colors={['#4CAF50', '#6BCB77']} // Green gradient
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name="check-circle-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Accept Ride</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleReject(false)} activeOpacity={0.7}>
              <LinearGradient
                colors={['#FF5722', '#FF8A65']} // Red gradient
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name="close-circle-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {jobStatus === 'accepted' && (
          <TouchableOpacity style={styles.actionButtonFull} onPress={handleOnTheWay} activeOpacity={0.7}>
            <LinearGradient
              colors={['#2196F3', '#64B5F6']} // Blue gradient
              style={styles.actionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Icon name="routes" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Proceed to Pickup</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {jobStatus === 'on_the_way' && ( // Added 'on_the_way' status for clarity
          <TouchableOpacity
            style={styles.actionButtonFull}
            onPress={handleArrived}
            disabled={!isNearby}
            activeOpacity={!isNearby ? 1 : 0.7}
          >
            <LinearGradient
              colors={!isNearby ? ['#546E7A', '#78909C'] : ['#2196F3', '#64B5F6']} // Grey if disabled, blue otherwise
              style={styles.actionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Icon name="map-marker-check" size={20} color={!isNearby ? '#bbb' : '#fff'} />
              <Text style={[styles.actionButtonText, !isNearby && styles.disabledText]}>
                Arrived {isNearby ? '' : `(${Math.round(haversine(driverCoords, pickupCoords))}m away)`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* <-- Arrived & No Show Buttons when 'arrived_ready' --> */}
        {jobStatus === 'arrived_ready' && ( // This is the status when driver is near pickup and needs to confirm arrival
          <View style={styles.splitButtonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.smallActionButton]} // Smaller width for two buttons
              onPress={handleArrived}
              disabled={!isNearby}
              activeOpacity={!isNearby ? 1 : 0.7}
            >
              <LinearGradient
                colors={!isNearby ? ['#546E7A', '#78909C'] : ['#2196F3', '#64B5F6']}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name="map-marker-check" size={20} color={!isNearby ? '#bbb' : '#fff'} />
                <Text style={[styles.actionButtonText, !isNearby && styles.disabledText]}>
                  Arrived
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.smallActionButton]} onPress={handleNoShow} activeOpacity={0.7}>
              <LinearGradient
                colors={['#FF5722', '#FF8A65']} // Red gradient for No Show
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name="account-off" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>No Show</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        {/* <-- END: Arrived & No Show Buttons --> */}


        {/* <-- NEW: Start Ride & No Show Buttons when 'arrived' --> */}
        {jobStatus === 'arrived' && (
          <View style={styles.splitButtonContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.smallActionButton]} 
              onPress={handleOnStart} 
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#2196F3', '#64B5F6']}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name="play-circle-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Start Ride</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.smallActionButton]} 
              onPress={handleNoShow} 
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#FF5722', '#FF8A65']} // Red gradient for No Show
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name="account-off" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>No Show</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        {/* <-- END NEW: Start Ride & No Show Buttons --> */}
      </View>

      {/* --- Job Details Card --- */}
      <View style={styles.card}>
        <SectionHeader title="Trip Details" icon="information-outline" />
         {currentJob.notes && (
          <View style={styles.notesSection}>
            <Icon name="note-text-outline" size={18} color={COLOR_WARNING} />
            <Text style={styles.notesText}>{currentJob.notes}</Text>
          </View>
        )}
        <View style={styles.fareContainer}>
          
            ({
            currentJob.earningsSoFar > 0 ? (
              <>
                <Text style={styles.fareLabel}>ESTIMATED FARE</Text>
                <Text style={styles.fareValue}>{formatCurrencyNZD(currentJob.earningsSoFar)}</Text>
              </>
          ) : null
          })

        </View>
          <View style={styles.fareContainer}>
          <Text style={styles.fareLabel}>Payment Method</Text>
           <Text style={styles.label}>{currentJob.paymentMethod === 'cash' ? 'Cash' : 'Card'}</Text>
          {/* <Text style={styles.fareValue}>{formatCurrencyNZD(currentJob.earningsSoFar)}</Text> */}
        </View>
          <View style={styles.fareContainer}> 
          <Text style={styles.fareLabel}>Payment Status</Text>
          <Text style={styles.label}>
            {currentJob.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
             
          </Text>
          {/* <Text style={styles.fareValue}>{formatCurrencyNZD(currentJob.earningsSoFar)}</Text> */}
        </View>
        <LabelValue icon="map-marker-outline" label="Pickup" value={currentJob.pickupLocation} color={COLOR_ACCENT_SECONDARY} />
        <LabelValue icon="flag-checkered" label="Dropoff" value={currentJob.dropoffLocation} color={COLOR_ERROR} />

        <View style={styles.rowMetrics}>
          <MetricBadge icon="map-marker-distance" text={`Distance: ${currentJob.distance || 'N/A'}`} />
          <MetricBadge icon="clock-outline" text={`ETA: ${currentJob.estimatedDuration || 'N/A'}`} />
        </View>

        <View style={styles.divider} />

        <SectionHeader title="Rider Info" icon="account-circle" />
        <LabelValue icon="account" label="Rider" value={currentJob.riderName} />
        {/* <-- NEW: Call/Recall Button Logic --> */}
        <LabelValue icon="phone" label="Contact" value={currentJob.riderPhone}>
          {showCallButton && currentJob?.riderPhone && (
            <TouchableOpacity 
              style={styles.callButton} 
              onPress={callInitiated ? handleRecall : handleCallRider}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={callInitiated ? ['#FFA500', '#FFD700'] : ['#007AFF', '#2196F3']} // Orange for recall, Blue for call
                style={styles.callButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Icon name={callInitiated ? "phone-refresh" : "phone"} size={18} color="#fff" />
                <Text style={styles.callButtonText}>
                  {callInitiated ? 'Recall' : 'Call'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LabelValue>
        {/* <-- END NEW: Call/Recall Button Logic --> */}
        <LabelValue icon="car-side" label="Vehicle" value={`${currentJob.vehicle?.model || 'N/A'} (${currentJob.vehicle?.plate || 'N/A'})`} />

       
      </View>
    </Animated.ScrollView>
  );
};

export default AcceptJobScreen;

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    paddingTop: StatusBar.currentHeight || 0,
    flexGrow: 1,
    backgroundColor: COLOR_BACKGROUND,
    paddingBottom: SPACING * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLOR_BACKGROUND,
  },
  loadingText: {
    color: COLOR_WARNING,
    marginTop: SPACING,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING * 1.5,
    paddingVertical: SPACING * 0.8,
    backgroundColor: COLOR_SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#282828',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  title: {
    fontSize: width * 0.05,
    fontWeight: '700',
    color: COLOR_TEXT_PRIMARY,
    flex: 1,
    textAlign: 'left',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: SPACING,
    paddingVertical: SPACING * 0.4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLOR_WARNING,
    marginLeft: SPACING,
  },
  counterText: {
    fontSize: width * 0.032,
    color: COLOR_WARNING,
    fontWeight: 'bold',
    marginLeft: SPACING * 0.2,
  },
  mapContainer: {
    height: height * 0.3,
    marginHorizontal: SPACING,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: SPACING * 1.2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A3A3A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  driverMarker: {
    backgroundColor: 'rgba(0,122,255,0.2)',
    padding: SPACING * 0.5,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: COLOR_ACCENT_PRIMARY,
    shadowColor: COLOR_ACCENT_PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING,
    marginTop: SPACING * 1.5,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: SPACING * 0.2,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  actionButtonFull: {
    width: '100%',
    marginHorizontal: SPACING,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING * 0.8,
    gap: SPACING * 0.4,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: width * 0.04,
  },
  disabledText: {
    color: '#d0d0d0',
  },
  card: {
    backgroundColor: COLOR_SURFACE,
    borderRadius: 12,
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 1.2,
    marginHorizontal: SPACING,
    marginTop: SPACING * 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLOR_ACCENT_PRIMARY,
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: SPACING * 0.4,
    marginBottom: SPACING * 0.8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3A3A3A',
    paddingBottom: SPACING * 0.4,
  },
  fareLabel: {
    fontSize: width * 0.035,
    fontWeight: '600',
    color: COLOR_TEXT_SECONDARY,
    textTransform: 'uppercase',
  },
  fareValue: {
    fontSize: width * 0.065,
    fontWeight: '900',
    color: COLOR_WARNING,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING * 0.6,
  },
  itemIcon: {
    marginRight: SPACING * 0.5,
  },
  labelValueContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: width * 0.038,
    fontWeight: '500',
    color: COLOR_TEXT_PRIMARY,
  },
  value: {
    fontSize: width * 0.04,
    color: COLOR_TEXT_PRIMARY,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  rowMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: SPACING * 0.8,
    paddingVertical: SPACING * 0.6,
    backgroundColor: '#282828',
    borderRadius: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: SPACING * 0.6,
    paddingVertical: SPACING * 0.3,
    borderRadius: 20,
    gap: SPACING * 0.2,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.4)',
    flex: 1,
    marginHorizontal: SPACING * 0.2,
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: width * 0.03,
    color: COLOR_TEXT_PRIMARY,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#3A3A3A',
    marginVertical: SPACING * 1.2,
  },
  notesSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING,
    padding: SPACING * 0.8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLOR_WARNING,
    gap: SPACING * 0.4,
  },
  notesText: {
    color: COLOR_WARNING,
    fontSize: width * 0.035,
    fontStyle: 'italic',
    flex: 1,
  },
  // --- NEW STYLES ---
  callButton: {
    marginLeft: SPACING, // Space between phone number and button
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  callButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING * 0.4,
    paddingHorizontal: SPACING * 0.8,
    gap: SPACING * 0.2,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: width * 0.035,
  },
  splitButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: SPACING * 0.5, // Adjust padding to keep buttons centered
  },
  smallActionButton: {
    flex: 0.48, // Adjust flex to make buttons share width, with a small gap
    marginHorizontal: SPACING * 0.2, // Small gap between buttons
  },
});
