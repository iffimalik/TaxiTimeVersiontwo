import React, { useEffect, useState, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
  Dimensions, // Import Dimensions for screen height
} from 'react-native';

import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useLocationStore from '../../store/locationStore';
import useJobStore from '../../store/jobStore';
import haversine from 'haversine-distance';
import { showConfirmationToast, showErrorToast, showInfoToast, showSuccessToast } from '../../utils/showToast';
import { changeRideStatus } from '../../utils/common';
import { ShiftContext } from '../../context/ShiftContext';
import { TarrifContext } from '../../context/TarrifContext';
import NetworkBanner from './NetworkBanner';
import LocationHeader from './HomeComponent/LocationBlink'
// Ensure you have a Google Maps API Key for MapViewDirections
// You can get one from Google Cloud Console
// const Maps_APIKEY = 'AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA'; // <<< IMPORTANT: Replace with your actual API Key
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// Helper function for time formatting
const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
};

const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

const { height: windowHeight, width: windowWidth } = Dimensions.get('window'); // Get window height

const JobTrackingScreen = ({ route }) => {
  const mapRef = useRef(null);
  const { job: initialJob } = route.params || {}; // Use initialJob to seed currentJob
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
    const heading = useLocationStore((state) => state.heading);
  const { currentJob, jobStatus, setJobStatus, updateCurrentJob } = useJobStore();
  const { clearSelectedTarrif, isTarrifSelected, selectedTarrif } = useContext(TarrifContext);
  const { driver } = useContext(ShiftContext);

  // Initialize currentJob from initialJob if jobStore is empty or needs to be synced
  useEffect(() => {
    // console.log('Initializing currentJob from initialJob:', currentJob , initialJob);
    if (initialJob && !currentJob?.id) {
      console.log('Khalash');
      updateCurrentJob(initialJob , 'initializeJobFromInitialJob'); // Use a specific action name for clarity
    }
  }, [initialJob, currentJob, updateCurrentJob]);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [etaToDestination, setEtaToDestination] = useState('Calculating...');
  const [distanceToDestination, setDistanceToDestination] = useState('Calculating...');
  
    const [isRouteOverviewShown, setIsRouteOverviewShown] = useState(true);

  const timer = useRef(null);

  // --- Real-time Elapsed Time Calculation ---
  useEffect(() => {
    if (!currentJob?.driver_job_start_time || currentJob?.status === 'completed') {
      clearInterval(timer.current);
      return;
    }

    const startTime = new Date(currentJob.driver_job_start_time).getTime();

    timer.current = setInterval(() => {
      const now = Date.now();
      const diffSeconds = Math.floor((now - startTime) / 1000);
      setElapsedTime(diffSeconds);
    }, 1000);

    return () => clearInterval(timer.current);
  }, [currentJob?.driver_job_start_time, currentJob?.status]);
  const openNavigation = useCallback(() => {
    const { destinationLat, destinationLng, dropoffLocation } = currentJob;
    if (destinationLat && destinationLng) {
      const scheme = Platform.OS === 'ios' ? 'maps:0,0?q=' : 'geo:0,0?q=';
      const latLng = `${destinationLat},${destinationLng}`;
      const label = dropoffLocation || 'Dropoff Location';
      const url = Platform.OS === 'ios' ? `${scheme}${label}@${latLng}` : `${scheme}${latLng}(${label})`;

      Linking.openURL(url).catch((err) => console.error('An error occurred while opening maps', err));
    } else {
      showInfoToast('Destination Missing', 'Destination coordinates are not available.');
    }
  }, [currentJob]);
  // --- Dynamic ETA and Distance Calculation (Conceptual) ---
  // In a real app, this would come from a routing API or more sophisticated logic
  useEffect(() => {
    if (currentJob && latitude && longitude) {
      const currentPos = { latitude, longitude };
      let targetLat, targetLng;

      if (currentJob.status === 'accepted' || currentJob.status === 'on_the_way') {
        // En route to pickup
        targetLat = currentJob.pickupLat;
        targetLng = currentJob.job_pickup_location_longitude;
      } else if (currentJob.status === 'started') {
        // En route to dropoff
        targetLat = currentJob?.dropoffLat;
        targetLng = currentJob?.dropoffLng;
      } else {
        setEtaToDestination('N/A');
        setDistanceToDestination('N/A');
        return;
      }

      if (targetLat && targetLng !== null && targetLat !== null) {
        const distanceMeters = haversine(currentPos, { latitude: targetLat, longitude: targetLng });
        setDistanceToDestination(formatDistance(distanceMeters));

        // Simple ETA estimation (replace with actual routing API call)
        const avgSpeedKmh = 30; // Average driving speed in km/h
        const avgSpeedMps = (avgSpeedKmh * 1000) / 3600; // meters per second
        const estimatedSeconds = distanceMeters / avgSpeedMps;
        setEtaToDestination(formatTime(Math.floor(estimatedSeconds)));
      } else {
        setDistanceToDestination('N/A');
        setEtaToDestination('N/A');
      }
    }
  }, [latitude, longitude, currentJob]);

  const handleCancelJob = useCallback(() => {
    showConfirmationToast({
      title: 'Cancel Job',
      message: 'Are you sure you want to cancel this job?',
      confirmText: 'Yes, Cancel',
      cancelText: 'No',
      onConfirm: async () => {
        clearInterval(timer.current);
        setJobStatus('cancelled');
        updateCurrentJob({ cancelledTime: new Date().toISOString() } , 'handleCancelJob'); // Use a specific action name for clarity
        showErrorToast('Job Cancelled', 'The job has been cancelled.');
        await changeRideStatus('cancelled', currentJob?.id, driver.driverId, driver.token, currentJob);
        
      },
    });
  }, [setJobStatus, updateCurrentJob, currentJob, driver]);
  const handleCompleteJob = useCallback(async () => {
    clearInterval(timer.current);
    setJobStatus('completed');
    updateCurrentJob({ complete_job_time: new Date().toISOString() } , 'handleCompleteJob'); // Use a specific action name for clarity

    showSuccessToast('Job Completed', 'The job has been successfully completed.');
    await changeRideStatus('completed', currentJob?.id, driver.driverId, driver.token, currentJob);
  }, [setJobStatus, updateCurrentJob, currentJob, driver]);

  const handlePauseJob = useCallback(
    async () => {
      const now = new Date().toISOString(); // Get current timestamp for the pause
      const currentPauseRecords = currentJob?.pause_records || []; // Get existing records or initialize an empty array

      const newPauseRecord = {
        pausedAt: now,
        resumedAt: null, // Will be filled when job is resumed
        durationSeconds: 0, // Will be calculated when job is resumed
      };

      const updatedPauseRecords = [...currentPauseRecords, newPauseRecord];

      await changeRideStatus('paused', currentJob?.id, driver?.driverId, driver?.token, {
        ...currentJob,
        pause_records: updatedPauseRecords, // Send updated records to backend if your API supports it
        status: 'paused', // Explicitly set status for API call
      });

      setJobStatus('paused'); // Set the current job status to 'paused'
      updateCurrentJob({
        pause_job_counter: (currentJob?.pause_job_counter || 0) + 1, // Increment counter
        pause_records: updatedPauseRecords, // Update local pause records
        status: 'paused', // Ensure local status is also updated
      }  , 'handlePauseJob'); // Use a specific action name for clarity

      showInfoToast('Job Paused', 'The job has been paused. Resume to continue.');
    },
    [setJobStatus, updateCurrentJob, currentJob, driver]
  ); // Dependencies for useCallback

  const handleCallRider = useCallback(() => {
    if (currentJob?.riderPhone) {
      Linking.openURL(`tel:${currentJob.riderPhone}`).catch((err) =>
        // Alert.alert('Error', `Could not dial: ${err.message}`)
        showErrorToast('Error', `Could not dial: ${err.message}`) // Use showErrorToast for consistency
      );
    } else {
      // Alert.alert('Error', 'Rider phone number not available.');
      showInfoToast('Error', 'Rider phone number not available.');
    }
  }, [currentJob?.riderPhone]);

  const handleMessageRider = useCallback(() => {
    if (currentJob?.riderPhone) {
      Linking.openURL(`sms:${currentJob.riderPhone}`).catch((err) =>
        // Alert.alert('Error', `Could not open messaging app: ${err.message}`)
        showErrorToast('Error', `Could not open messaging app: ${err.message}`) // Use showErrorToast for consistency
      );
    } else {
      // Alert.alert('Error', 'Rider phone number not available.');
      showErrorToast('Error', 'Rider phone number not available.'); // Use showErrorToast for consistency
    }
  }, [currentJob?.riderPhone]);

  const handleOpenNavigation = useCallback((lat, lng, label) => {
    const scheme = Platform.select({ ios: 'maps:0,0?', android: 'geo:0,0?' });
    const url = Platform.select({
      ios: `${scheme}q=${lat},${lng}(${label})`,
      android: `${scheme}q=${lat},${lng}(${label})`,
    });
    Linking.openURL(url).catch((err) =>
      // Alert.alert('Error', `Could not open navigation: ${err.message}`)
      showErrorToast('Error', `Could not open navigation: ${err.message}`) // Use showErrorToast for consistency
    );
  }, []);



  if (!currentJob || !currentJob.id) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5722" />
        <Text style={styles.loadingText}>Loading Job Details...</Text>
      </View>
    );
  }
  const formatDuration = (seconds) => {
    if (!seconds || seconds < 0) return '0s';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${parseInt(h)}h ${parseInt(m)}m`;
    if (m > 0) return `${parseInt(m)}m ${parseInt(s)}s`;
    return `${parseInt(s)}s`;
  };

  const currentPosition = latitude && longitude ? { latitude, longitude } : null;
  const pickupCoords = { latitude: currentJob?.pickupLat, longitude: currentJob?.pickupLng };
  const dropoffCoords = { latitude: currentJob?.dropoffLat, longitude: currentJob?.dropoffLng };

  // Determine button visibility based on job status
  const showCompleteButton = currentJob.status === 'started';
  const showCancelButton = currentJob.status !== 'completed' && currentJob.status !== 'cancelled';

//   const MOVEMENT_SPEED_THRESHOLD_MPS = 0.5;
// const ARRIVED_DISTANCE_THRESHOLD_METERS = 30;
// const routeOverviewTimer = useRef(null);

// useEffect(() => {
//   if (
//     !mapRef.current ||
//     !currentJob?.currentLocation?.latitude ||
//     !currentJob?.currentLocation?.longitude
//   ) {
//     return;
//   }

//   const {
//     latitude: currentLat,
//     longitude: currentLng,
//     heading,
//     speed
//   } = currentJob.currentLocation;

//   const isMoving = (speed !== undefined && speed !== null) ? speed > MOVEMENT_SPEED_THRESHOLD_MPS : false;

//   let targetLat, targetLng;
//   let isAtDestinationThreshold = false;

//   if (jobStatus === 'accepted' || jobStatus === 'on_the_way') {
//     targetLat = currentJob.pickupLat;
//     targetLng = currentJob.pickupLng;
//   } else if (jobStatus === 'started') {
//     targetLat = currentJob?.dropoffLat;
//     targetLng = currentJob?.dropoffLng;
//   }

//   if (targetLat && targetLng && currentLat && currentLng) {
//     const distanceToTarget = haversine(
//       { latitude: currentLat, longitude: currentLng },
//       { latitude: targetLat, longitude: targetLng }
//     );
//     isAtDestinationThreshold = distanceToTarget <= ARRIVED_DISTANCE_THRESHOLD_METERS;
//   }

//   const shouldShowRouteOverview =
//     (
//       (jobStatus === 'on_the_way' && !isRouteOverviewShown && currentJob.prevStatus !== 'on_the_way') ||
//       (jobStatus === 'started' && !isRouteOverviewShown && currentJob.prevStatus !== 'started')
//     ) &&
//     targetLat && targetLng && currentLat && currentLng;

//   if (shouldShowRouteOverview) {
//     const coordinatesToFit = [
//       { latitude: currentLat, longitude: currentLng },
//       { latitude: targetLat, longitude: targetLng },
//     ];

//     mapRef.current.fitToCoordinates(coordinatesToFit, {
//       edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
//       animated: true,
//     });

//     setIsRouteOverviewShown(true);

//     if (routeOverviewTimer.current) clearTimeout(routeOverviewTimer.current);
//     routeOverviewTimer.current = setTimeout(() => {
//       setIsRouteOverviewShown(false);
//     }, 5000);

//     return;
//   }

//   if (isRouteOverviewShown || jobStatus === 'completed' || jobStatus === 'cancelled') {
//     return;
//   }

//   let cameraOptions = {
//     center: { latitude: currentLat, longitude: currentLng },
//     heading: parseInt(heading || 0),
//     altitude: 500,
//     duration: 500,
//   };

//   if (isAtDestinationThreshold) {
//     cameraOptions.zoom = 19.5;
//     cameraOptions.pitch = 45;
//   } else if (isMoving) {
//     cameraOptions.zoom = 18;
//     cameraOptions.pitch = 45;
//   } else {
//     cameraOptions.zoom = 15;
//     cameraOptions.pitch = 0;
//   }

//   mapRef.current.animateCamera(cameraOptions);

//   updateCurrentJob({ prevStatus: jobStatus });

// }, [
//   currentJob?.currentLocation,
//   currentJob?.heading,
//   jobStatus,
//   isRouteOverviewShown,
//   updateCurrentJob,
//   currentJob?.pickupLat,
//   currentJob?.pickupLng,
//   currentJob?.dropoffLat,
//   currentJob?.dropoffLng,
//   mapRef
// ]);

// This related useEffect is crucial for resetting the route overview flag
// and should also be included in your component.
// useEffect(() => {
//   if (
//     currentJob?.id !== (currentJob?.prevId || null) ||
//     jobStatus === 'completed' ||
//     jobStatus === 'cancelled'
//   ) {
//     setIsRouteOverviewShown(false);
//     if (routeOverviewTimer.current) clearTimeout(routeOverviewTimer.current);
//   }
//   updateCurrentJob({ prevId: currentJob?.id });
// }, [currentJob?.id, jobStatus, updateCurrentJob]);


  useEffect(() => {
    if (
      mapRef.current &&
      latitude  &&
       longitude &&
     heading !== undefined &&
      !isNaN(heading)
    ) {
      if (mapRef.current) {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: latitude,
              longitude: longitude,
            },
            heading: parseInt(heading), // hard-coded test
            pitch: 60,
            zoom: 17, // Adjust zoom level as needed
            altitude: 500, // optional: tweak camera height
          },
          { duration: 500 }
        );
      }
    }
  }, [currentJob?.heading, currentJob?.currentLocation]);
  const STADIA_MAPS_ALIDADE_SMOOTH = 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <NetworkBanner />

      {/* Header with Job ID and SOS - More Compact */}
      <View style={styles.headerCompact}>
        <Text style={styles.headerTitleCompact}>Job: {currentJob.id.slice(-10)} </Text>
        
        
      </View>
   
      {/* Tariff Section - More Compact */}
       
         
          <LocationHeader />
       

      {/* Enlarged Earnings Counter */}
      <View style={styles.earningsCounterContainer}>
        <Icon name="cash-multiple" size={35} color="#FFD700" />
        <View style={styles.earningsTextBlock}>
          <Text style={styles.earningsLabel}>Total Fare</Text>
          <Text style={styles.earningsValue}>$ {currentJob?.earningsSoFar || '0.00'}</Text>
        </View>
      </View>

      {/* Live Metrics Panel (Condensed further) */}
      <View style={styles.meterPanelCondensed}>
        <View style={styles.meterBlockCondensed}>
          <Icon name="timer-outline"PROVIDER_GOOGLE size={18} color="#FFD700" />
          <View>
            <Text style={styles.meterLabelCondensed}>Time</Text>
            <Text style={styles.meterValueCondensed}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>

        <View style={styles.dividerCondensed} />

        <View style={styles.meterBlockCondensed}>
          <Icon name="map-marker-distance" size={18} color="#8BC34A" />
          <View>
            <Text style={styles.meterLabelCondensed}>Travelled</Text>
            <Text style={styles.meterValueCondensed}>{formatDistance(currentJob?.distanceTravelled || 0)}</Text>
          </View>
        </View>

        <View style={styles.dividerCondensed} />

        <View style={styles.meterBlockCondensed}>
          <Icon name="currency-usd" size={18} color="#FFD700" />
          <View>
            <Text style={styles.meterLabelCondensed}>Est. Fare</Text>
            <Text style={styles.meterValueCondensed}>$ {currentJob?.fair || '0.00'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.pricingBreakdownContainer}>
        <Text style={styles.pricingBreakdownText}>
          Start: <Text style={styles.pricingValue}>${currentJob?.pricingBreakdown?.startingPrice}</Text>
        </Text>
        <Text style={styles.pricingBreakdownText}>
          Distance: <Text style={styles.pricingValue}>${currentJob?.pricingBreakdown?.distanceCost}</Text>
        </Text>
        <Text style={styles.pricingBreakdownText}>
          Waiting:{' '}
          <Text style={styles.pricingValue}>
            ${currentJob.pricingBreakdown?.waitingCost} ({formatDuration(currentJob?.pricingBreakdown?.waitingSeconds)})
          </Text>
        </Text>
      </View>

      {/* ETA and Distance to Destination */}
      <View style={styles.etaPanel}>
        <View style={styles.etaBlock}>
          <Icon name="clock-outline" size={18} color="#ADD8E6" />
          <Text style={styles.etaText}>ETA: {etaToDestination}</Text>
        </View>
        <View style={styles.etaBlock}>
          <Icon name="map-marker-path" size={18} color="#ADD8E6" />
          <Text style={styles.etaText}>Distance: {distanceToDestination}</Text>
        </View>
      </View>

      {/* Rider & Trip Info Card (Further Simplified and Condensed) */}
      <View style={styles.infoCardSimplified}>
        <View style={styles.riderContactRow}>
          <Text style={styles.riderNameSimplified}>{currentJob.riderName || 'N/A'}</Text>
          {/* Rider Phone removed from display as per instructions to deemphasize */}
          <TouchableOpacity onPress={handleCallRider} style={styles.contactButtonSimplified}>
            <Icon name="phone" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMessageRider} style={styles.contactButtonSimplified}>
            <Icon name="message-text" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.locationRow}>
          <Icon name="map-marker-outline" size={16} color="#4CAF50" />
          <Text style={styles.locationTextSimplified}>{currentJob.pickupLocation || 'N/A'}</Text>
          <TouchableOpacity
            onPress={() => handleOpenNavigation(currentJob.pickupLat, currentJob.pickupLng, currentJob.pickupLocation)}
            style={styles.navigateButtonSimplified}
          >
            <Icon name="navigation" size={16} color="#2196F3" />
          </TouchableOpacity>
        </View>
        <View style={styles.locationRow}>
          <Icon name="flag-checkered" size={16} color="#FF5722" />
          <Text style={styles.locationTextSimplified}>{currentJob.dropoffLocation || 'N/A'}</Text>
          <TouchableOpacity
            onPress={() => handleOpenNavigation(currentJob.dropoffLat, currentJob.dropoffLng, currentJob.dropoffLocation)}
            style={styles.navigateButtonSimplified}
          >
            <Icon name="navigation" size={16} color="#2196F3" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map View */}
      {currentJob?.currentLocation ? (
        <View style={styles.mapContainer}>
          {currentJob?.destinationLat && currentJob?.destinationLng && (
            <TouchableOpacity style={styles.navigationButton} onPress={openNavigation}>
              <Icon name="directions" size={20} color="#fff" />
              <Text style={styles.navigationButtonText}>Navigate</Text>
            </TouchableOpacity>
          )}

          <MapView
            ref={mapRef}
            cacheEnabled={false}
        // IMPORTANT: Remove or comment out provider={PROVIDER_GOOGLE}
        // When no provider is specified, react-native-maps will fall back to
        // Apple Maps on iOS and Google Maps on Android. To ensure OSM is used,
        // we use UrlTile.
        // provider={PROVIDER_GOOGLE} // REMOVE THIS LINE for a completely free map via UrlTile

        style={styles.map}
        initialRegion={{
          latitude: currentJob?.currentLocation?.latitude,
          longitude: currentJob?.currentLocation?.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        // The following properties (showsBuildings, customMapStyle, etc.)
        // are primarily for Google Maps. While some might be ignored by OSM,
        // keeping them might not harm, but they won't have the same effect.
        showsBuildings={false}
        pitchEnabled={true}
        zoomEnabled
        scrollEnabled
        rotateEnabled
        zoomControlEnabled
        zoomTapEnabled
        // loadingEnabled
        // customMapStyle={minimalRoadMapStyle} // This custom style is for Google Maps only. Remove it.
        showsCompass={false}
        showsMyLocationButton={false}
        showsUserLocation={false}
        showsTraffic={false}
        showsScale={false}
        showsIndoors={false}
        showsIndoorLevelPicker={false}
        showsPointsOfInterest={false}
            // ref={mapRef}
            // // provider={PROVIDER_GOOGLE}
            // style={styles.map}
            // initialRegion={{
            //   latitude: currentJob?.currentLocation?.latitude || 0,
            //   longitude: currentJob?.currentLocation?.longitude || 0,
            //   latitudeDelta: 0.01,
            //   longitudeDelta: 0.01,
            // }}
            // showsBuildings={true}
            // pitchEnabled={true}
            // zoomEnabled
            // scrollEnabled
            // rotateEnabled
            // zoomControlEnabled
            // zoomTapEnabled
            // loadingEnabled
            // // customMapStyle={mapStyle}
            // showsUserLocation={false} // we're using custom marker
          >
             {/* <UrlTile
                      urlTemplate={OSM_TILE_URL}
                      zIndex={-1} // Ensure tiles are rendered below markers
            /> */}
             <UrlTile
                      urlTemplate={STADIA_MAPS_ALIDADE_SMOOTH}
                      zIndex={-1} // Ensure tiles are rendered below markers
            />
             
            <Marker coordinate={currentJob?.currentLocation} flat={true} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.markerContainer}>
                <Icon name="taxi" size={25} color="red" backgroundColor="white" style={styles.taxiIcon} />
                <View style={styles.pinBottom} />
              </View>
            </Marker>

            <Marker
              coordinate={dropoffCoords}
              title="Dropoff"
              description={currentJob?.dropoffLocation}
              pinColor="#FF5722" // Red
            >
              <Icon name="flag-checkered" size={25} color="#FF5722" />
            </Marker>
          </MapView>
        </View>
      ) : (
        <ActivityIndicator style={styles.mapLoadingIndicator} size="large" color="#007AFF" />
      )}

      {/* Dynamic Action Buttons - Fixed at Bottom */}
      <View style={styles.actionButtonsContainer}>
        {showCompleteButton && (
          <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={handleCompleteJob}>
            <Icon name="check-circle-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Complete</Text>
          </TouchableOpacity>
        )}
        {showCompleteButton && (
          <TouchableOpacity style={[styles.actionButton, styles.PauseButton]} onPress={handlePauseJob}>
            <Icon name="pause-circle-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Pause</Text>
          </TouchableOpacity>
        )}
        {showCancelButton && (
          <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancelJob}>
            <Icon name="close-circle-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default JobTrackingScreen;

const mapStyle = [
  // Hide points of interest (POIs) to declutter the map
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  // Further hide parks specifically if POI off isn't enough
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ visibility: 'off' }],
  },
  // Optionally, you can fine-tune other features
  // {
  //   featureType: 'road',
  //   elementType: 'geometry',
  //   stylers: [{ color: '#38414e' }],
  // },
  // {
  //   featureType: 'water',
  //   elementType: 'geometry',
  //   stylers: [{ color: '#17263c' }],
  // },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: StatusBar.currentHeight + 10, // Ensure content starts below status bar
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
  // Header Compact Styles
  headerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15, // Reduced padding
    paddingVertical: 10, // Reduced padding
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitleCompact: {
    color: '#fff',
    fontSize: 16, // Smaller font
    fontWeight: 'bold',
  },
  sosButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#330000',
    paddingHorizontal: 8, // Reduced padding
    paddingVertical: 4, // Reduced padding
    borderRadius: 15, // Smaller border radius
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  sosButtonTextCompact: {
    color: '#FF5722',
    marginLeft: 3, // Reduced margin
    fontWeight: 'bold',
    fontSize: 12, // Smaller font
  },

  // Tariff Section Compact Styles
  tariffSectionCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(20,20,20,0.9)',
    paddingVertical: 8, // Reduced padding
    paddingHorizontal: 15,
    borderRadius: 8, // Smaller border radius
    marginHorizontal: 15,
    marginTop: 8,
  },
  tariffTextCompact: {
    color: '#FFD700',
    fontSize: 14, // Smaller font
    fontWeight: 'bold',
  },
  tariffRatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow wrapping for small screens
    marginTop: 2,
  },
  tariffRateText: {
    fontSize: 9, // Very small font for rates
    color: 'white',
    marginRight: 8, // Spacing between rate items
  },
  changeTariffButtonCompact: {
    backgroundColor: 'green',
    padding: 6, // Smaller padding
    borderRadius: 12, // Smaller border radius
  },

  // Earnings Counter Styles
  earningsCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.9)',
    paddingVertical: 12, // Reduced padding
    borderRadius: 10, // Smaller border radius
    marginHorizontal: 15,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  earningsTextBlock: {
    marginLeft: 8,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 12, // Smaller font
    color: '#ccc',
    fontWeight: '500',
  },
  earningsValue: {
    fontSize: 35, // Slightly reduced but still large
    fontWeight: 'bold',
    color: '#FFD700', // Gold color for earnings
  },

  // Condensed Meter Panel Styles
  meterPanelCondensed: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.9)',
    paddingVertical: 6, // Further reduced padding
    paddingHorizontal: 10,
    borderRadius: 8, // Smaller border radius
    marginHorizontal: 15,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  meterBlockCondensed: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3, // Further reduced gap
  },
  meterLabelCondensed: {
    fontSize: 10, // Smaller font size
    color: '#ccc',
    fontWeight: '500',
  },
  meterValueCondensed: {
    fontSize: 14, // Smaller font size
    fontWeight: '700',
    color: '#fff',
  },
  dividerCondensed: {
    width: 1,
    height: 25, // Shorter divider
    backgroundColor: '#444',
  },

  // Pricing Breakdown Styles
  pricingBreakdownContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(30,30,30,0.9)',
    paddingVertical: 6, // Reduced padding
    marginHorizontal: 15,
    marginTop: 8,
    borderRadius: 8, // Smaller border radius
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pricingBreakdownText: {
    fontSize: 14, // Smaller font
    color: 'white',
  },
  pricingValue: {
    fontSize: 12, // Smaller font
    color: 'orange',
    fontWeight: 'bold',
  },

  // ETA Panel Styles
  etaPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(30,30,30,0.9)',
    paddingVertical: 6, // Reduced padding
    marginHorizontal: 15,
    marginTop: 8,
    borderRadius: 8, // Smaller border radius
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  etaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3, // Reduced gap
  },
  etaText: {
    color: '#ADD8E6',
    fontSize: 12, // Smaller font
    fontWeight: '600',
  },

  // Simplified Info Card Styles
  infoCardSimplified: {
    backgroundColor: 'rgba(25,25,25,0.95)',
    borderRadius: 10, // Smaller border radius
    padding: 8, // Reduced padding
    marginHorizontal: 15,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  riderContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 4, // Reduced padding
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 4,
  },
  riderNameSimplified: {
    color: '#fff',
    fontSize: 14, // Smaller font
    fontWeight: 'bold',
    marginRight: 5,
  },
  contactButtonSimplified: {
    backgroundColor: '#333',
    padding: 4, // Smaller padding
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#555',
    marginLeft: 5, // Spacing between buttons
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4, // Reduced margin
    gap: 5, // Reduced gap
  },
  locationTextSimplified: {
    color: '#fff',
    fontSize: 11, // Smaller font
    flex: 1, // Allows text to take available space
  },
  navigateButtonSimplified: {
    padding: 2, // Smaller padding
    borderRadius: 4,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
  },

  // Map View Styles
  mapContainer: {
    flex: 1, // Map takes up all available space
    marginHorizontal: 15,
    marginTop: 8,
    borderRadius: 10, // Smaller border radius
    overflow: 'hidden', // Ensures border radius applies
    borderWidth: 1,
    borderColor: '#333',
  },
  map: {
    width: '100%',
    height: '100%', // Map takes full height of its container
  },
  mapLoadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 8, // Reduced padding
    paddingHorizontal: 12, // Reduced padding
    borderRadius: 6, // Smaller border radius
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute', // Position over the map
    top: 10,
    right: 10,
    zIndex: 1, // Ensure it's above the map
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 14, // Smaller font
    marginLeft: 5,
  },
  pinBottom: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'red',
    marginBottom: -3,
  },
  markerContainer: {
    alignItems: 'center',
  },
  taxiIcon: {
    borderRadius: 50,
    padding: 5,
  },

  // Action Buttons - Fixed at Bottom Styles
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10, // Reduced padding
    paddingHorizontal: 10,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Reduced padding
    paddingHorizontal: 12, // Reduced padding
    borderRadius: 8,
    gap: 5, // Reduced gap
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14, // Smaller font
    fontWeight: 'bold',
  },
  completeButton: {
    backgroundColor: '#4CAF50', // Green
  },
  PauseButton: {
    backgroundColor: '#FF9800', // Orange for pause
  },
  cancelButton: {
    backgroundColor: '#F44336', // Red
  },
});