import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Using MaterialCommunityIcons for variety
import Vehicle3D from './Vehicle3D'; // Assuming this component exists
import useLocationStore from '../../store/locationStore';
import useJobStore from '../../store/jobStore';
import haversine from 'haversine-distance';
import { showConfirmationToast, showErrorToast, showInfoToast, showSuccessToast } from '../../utils/showToast';

// Ensure you have a Google Maps API Key for MapViewDirections
// You can get one from Google Cloud Console
const GOOGLE_MAPS_APIKEY = 'AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA'; // <<< IMPORTANT: Replace with your actual API Key

// Helper function for time formatting
const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
};

// Helper for distance formatting
const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

const JobTrackingScreen = ({ route }) => {
  const { job: initialJob } = route.params || {}; // Use initialJob to seed currentJob
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const { currentJob, setJobStatus, updateCurrentJob } = useJobStore();

  // Initialize currentJob from initialJob if jobStore is empty or needs to be synced
  useEffect(() => {
    if (initialJob && !currentJob?.id) {
      updateCurrentJob(initialJob);
    }
  }, [initialJob, currentJob, updateCurrentJob]);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [vehicleHeading, setVehicleHeading] = useState(0); // For Vehicle3D component
  const [etaToDestination, setEtaToDestination] = useState('Calculating...');
  const [distanceToDestination, setDistanceToDestination] = useState('Calculating...');

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
  }, [currentJob, showInfoToast]);
  // --- Dynamic ETA and Distance Calculation (Conceptual) ---
  // In a real app, this would come from a routing API or more sophisticated logic
  useEffect(() => {
    if (currentJob && latitude && longitude) {
      const currentPos = { latitude, longitude };
      let targetLat, targetLng;

      if (currentJob.status === 'accepted' || currentJob.status === 'on_the_way') {
        // En route to pickup
        targetLat = currentJob.pickupLat;
        targetLng = currentJob.pickupLng;
      } else if (currentJob.status === 'started') {
        // En route to dropoff
        targetLat = currentJob.dropoffLat;
        targetLng = currentJob.dropoffLng;
      } else {
        setEtaToDestination('N/A');
        setDistanceToDestination('N/A');
        return;
      }

      if (targetLat && targetLng) {
        const distanceMeters = haversine(currentPos, { latitude: targetLat, longitude: targetLng });
        setDistanceToDestination(formatDistance(distanceMeters));

        // Simple ETA estimation (replace with actual routing API call)
        const avgSpeedKmh = 30; // Average driving speed in km/h
        const avgSpeedMps = avgSpeedKmh * 1000 / 3600; // meters per second
        const estimatedSeconds = distanceMeters / avgSpeedMps;
        setEtaToDestination(formatTime(Math.floor(estimatedSeconds)));
      }
    }
  }, [latitude, longitude, currentJob]);


  // --- Action Handlers ---
  // const handleArrivedAtPickup = useCallback(() => {
  //   Alert.alert(
  //     'Confirm Arrival',
  //     'Are you sure you have arrived at the pickup location?',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Confirm',
  //         onPress: () => {
  //           setJobStatus('arrived');
  //           updateCurrentJob({ arrivedTime: new Date().toISOString() });
  //           Alert.alert('Status Updated', 'You have arrived at the pickup location.');
  //         },
  //       },
  //     ]
  //   );
  // }, [setJobStatus, updateCurrentJob]);
const handleArrivedAtPickup = useCallback(() => {
  showConfirmationToast({
    title: 'Confirm Arrival',
    message: 'Are you sure you have arrived at the pickup location?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {
      setJobStatus('arrived');
      updateCurrentJob({ arrivedTime: new Date().toISOString() });
      showSuccessToast('Status Updated', 'You have arrived at the pickup location.');
    },
  });
}, [setJobStatus, updateCurrentJob]);

  // const handleStartRide = useCallback(() => {
  //   Alert.alert(
  //     'Confirm Start Ride',
  //     'Are you sure the ride has started?',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Confirm',
  //         onPress: () => {
  //           setJobStatus('started');
  //           updateCurrentJob({ driver_job_start_time: new Date().toISOString() });
           
  //           showInfoToast('Ride Started', 'You can now navigate to the dropoff location.');
  //         },
  //       },
  //     ]
  //   );
  // }, [setJobStatus, updateCurrentJob]);
const handleStartRide = useCallback(() => {
  showConfirmationToast({
    title: 'Confirm Start Ride',
    message: 'Are you sure the ride has started?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {
      setJobStatus('started');
      updateCurrentJob({ driver_job_start_time: new Date().toISOString() });
      showInfoToast('Ride Started', 'You can now navigate to the dropoff location.');
    },
  });
}, [setJobStatus, updateCurrentJob]);

  // const handleCompleteJob = useCallback(() => {
  //   Alert.alert(
  //     'Confirm Completion',
  //     'Are you sure you want to complete this job?',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Confirm',
  //         onPress: () => {
  //           clearInterval(timer.current);
  //           setJobStatus('completed');
  //           updateCurrentJob({ complete_job_time: new Date().toISOString() });
  //           Alert.alert('Job Completed', 'The job has been successfully completed.');

            
  //           // Navigate to a rating/summary screen here
  //           // navigate('CompleteJobScreen', { job: currentJob });
  //         },
  //       },
  //     ]
  //   );
  // }, [setJobStatus, updateCurrentJob]);

  // const handleCancelJob = useCallback(() => {
  //   Alert.alert(
  //     'Cancel Job',
  //     'Are you sure you want to cancel this job?',
  //     [
  //       { text: 'No', style: 'cancel' },
  //       {
  //         text: 'Yes, Cancel',
  //         style: 'destructive',
  //         onPress: () => {
  //           clearInterval(timer.current);
  //           setJobStatus('cancelled');
  //           updateCurrentJob({ cancelledTime: new Date().toISOString() });
  //           Alert.alert('Job Cancelled', 'The job has been cancelled.');
  //           // Navigate back or to dashboard
  //         },
  //       },
  //     ]
  //   );
  // }, [setJobStatus, updateCurrentJob]);
const handleCancelJob = useCallback(() => {
  showConfirmationToast({
    title: 'Cancel Job',
    message: 'Are you sure you want to cancel this job?',
    confirmText: 'Yes, Cancel',
    cancelText: 'No',
    onConfirm: () => {
      clearInterval(timer.current);
      setJobStatus('cancelled');
      updateCurrentJob({ cancelledTime: new Date().toISOString() });
      showErrorToast('Job Cancelled', 'The job has been cancelled.');
      // You can also add: navigation.navigate('Dashboard') if needed
    },
  });
}, [setJobStatus, updateCurrentJob]);
const handleCompleteJob = useCallback(() => {
  showConfirmationToast({
    title: '✅ Confirm Completion',
    message: 'Are you sure you want to complete this job?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {
      clearInterval(timer.current);
      setJobStatus('completed');
      updateCurrentJob({ complete_job_time: new Date().toISOString() });
        
      showSuccessToast('Job Completed', 'The job has been successfully completed.');
       
      // Navigate to a rating/summary screen here
      // navigate('CompleteJobScreen', { job: currentJob });
    },
  });
}, [setJobStatus, updateCurrentJob]);

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

  // const handleSOS = useCallback(() => {
  //   Alert.alert(
  //     'Emergency SOS',
  //     'Are you in an emergency? This will alert authorities or support.',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Confirm SOS',
  //         style: 'destructive',
  //         onPress: () => {
  //           // Implement actual SOS logic here (e.g., send location, alert support)
  //           Alert.alert('SOS Activated', 'Emergency services have been alerted.');
  //         },
  //       },
  //     ]
  //   );
  // }, []);
    const handleSOS = useCallback(() => {
      showConfirmationToast({
        title: '🚨 Emergency SOS',
        message: 'Are you in an emergency? This will alert authorities or support.',
        confirmText: 'Confirm SOS',
        cancelText: 'Cancel',
        confirmType: 'destructive', // Optional styling indicator
        onConfirm: () => {
          // 🔴 Implement your actual SOS logic here
          // e.g., sendLocationToSupport();

          showErrorToast('SOS Activated', 'Emergency services have been alerted.');
        },
      });
    }, []);

  if (!currentJob || !currentJob.id) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5722" />
        <Text style={styles.loadingText}>Loading Job Details...</Text>
      </View>
    );
  }

  const currentPosition = latitude && longitude ? { latitude, longitude } : null;
  const pickupCoords = { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng };
  const dropoffCoords = { latitude: currentJob.dropoffLat, longitude: currentJob.dropoffLng };

  // Determine the route to display based on job status
  let routeOrigin = currentPosition;
  let routeDestination = pickupCoords;
  let routeStrokeColor = '#4CAF50'; // Green for pickup route

  if (currentJob.status === 'started' || currentJob.status === 'arrived') {
    routeOrigin = currentPosition;
    routeDestination = dropoffCoords;
    routeStrokeColor = '#2196F3'; // Blue for dropoff route
  } else if (currentJob.status === 'completed' || currentJob.status === 'cancelled') {
    routeOrigin = null; // No active route to show
    routeDestination = null;
  }

  // Determine button visibility based on job status
  const showArrivedButton = currentJob.status === 'accepted' || currentJob.status === 'on_the_way';
  const showStartButton = currentJob.status === 'arrived';
  const showCompleteButton = currentJob.status === 'started';
  const showCancelButton = currentJob.status !== 'completed' && currentJob.status !== 'cancelled';


  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header with Job ID and SOS */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job: {currentJob.id.slice(-10)}</Text>
        <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
          <Icon name="alert-circle-outline" size={24} color="#FF5722" />
          <Text style={styles.sosButtonText}>SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Live Metrics Panel */}
      <View style={styles.meterPanel}>
        <View style={styles.meterBlock}>
          <Icon name="timer-outline" size={24} color="#FFD700" />
          <View>
            <Text style={styles.meterLabel}>Time</Text>
            <Text style={styles.meterValue}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.meterBlock}>
          <Icon name="map-marker-distance" size={24} color="#8BC34A" />
          <View>
            <Text style={styles.meterLabel}>Travelled</Text>
            <Text style={styles.meterValue}>
              {formatDistance(currentJob?.distanceTravelled || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.meterBlock}>
          <Icon name="cash-multiple" size={24} color="#FFD700" />
          <View>
            <Text style={styles.meterLabel}>Earnings</Text>
            <Text style={styles.meterValue}>$ {currentJob?.earningsSoFar || '0.00'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.meterBlock}>
          <Icon name="currency-usd" size={24} color="#FFD700" />
          <View>
            <Text style={styles.meterLabel}>Est. Fare</Text>
            <Text style={styles.meterValue}>$ {currentJob?.estimatedFare || '0.00'}</Text>
          </View>
        </View>
      </View>

      {/* ETA and Distance to Destination */}
      <View style={styles.etaPanel}>
        <View style={styles.etaBlock}>
          <Icon name="clock-outline" size={20} color="#ADD8E6" />
          <Text style={styles.etaText}>ETA: {etaToDestination}</Text>
        </View>
        <View style={styles.etaBlock}>
          <Icon name="map-marker-path" size={20} color="#ADD8E6" />
          <Text style={styles.etaText}>Distance: {distanceToDestination}</Text>
        </View>
      </View>


      {/* Rider & Trip Info Card */}
      <ScrollView style={styles.infoCardContainer}>
        <View style={styles.infoCard}>
          <View style={styles.riderHeader}>
            <Icon name="account-circle" size={40} color="#FFD700" />
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{currentJob.riderName || 'N/A'}</Text>
              <Text style={styles.riderPhone}>{currentJob.riderPhone || 'N/A'}</Text>
            </View>
            <View style={styles.contactButtons}>
              <TouchableOpacity onPress={handleCallRider} style={styles.contactButton}>
                <Icon name="phone" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMessageRider} style={styles.contactButton}>
                <Icon name="message-text" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tripDetails}>
            <View style={styles.locationBlock}>
              <Icon name="map-marker-outline" size={20} color="#4CAF50" />
              <Text style={styles.locationLabel}>Pickup:</Text>
              <Text style={styles.locationText}>{currentJob.pickupLocation || 'N/A'}</Text>
              <TouchableOpacity onPress={() => handleOpenNavigation(currentJob.pickupLat, currentJob.pickupLng, currentJob.pickupLocation)} style={styles.navigateButton}>
                <Icon name="navigation" size={20} color="#2196F3" />
              </TouchableOpacity>
            </View>
            <View style={styles.locationBlock}>
              <Icon name="flag-checkered" size={20} color="#FF5722" />
              <Text style={styles.locationLabel}>Dropoff:</Text>
              <Text style={styles.locationText}>{currentJob.dropoffLocation || 'N/A'}</Text>
              <TouchableOpacity onPress={() => handleOpenNavigation(currentJob.dropoffLat, currentJob.dropoffLng, currentJob.dropoffLocation)} style={styles.navigateButton}>
                <Icon name="navigation" size={20} color="#2196F3" />
              </TouchableOpacity>
            </View>
            {currentJob.notes && (
              <View style={styles.notesBlock}>
                <Icon name="note-text-outline" size={20} color="#FFD700" />
                <Text style={styles.notesText}>{currentJob.notes}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Map View */}
      {currentJob?.currentLocation ? (


        <>
          
         {currentJob?.destinationLat && currentJob?.destinationLng && (
        <TouchableOpacity style={styles.navigationButton} onPress={openNavigation}>
          <Icon name="directions" size={24} color="#fff" />
          <Text style={styles.navigationButtonText}>Open Navigation</Text>
        </TouchableOpacity>
      )}

        <MapView
          style={styles.map}
          initialRegion={{
            latitude: currentJob?.currentLocation?.latitude,
            longitude: currentJob?.currentLocation?.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
            showsUserLocation={true} // We'll use a custom marker
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={true}
            pitchEnabled={true}
          region={{ // Keep map centered on current location
            latitude: currentJob?.currentLocation?.latitude,
            longitude: currentJob?.currentLocation?.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsMyLocationButton={true}
          showsCompass={true}
          showsTraffic={false}
          showsScale={true}
          showsIndoors={false}
          showsBuildings={false}
          showsPointsOfInterest={false}
          followsUserLocation={true} // Automatically follow user location
          zoomControlEnabled={true}
          zoomTapEnabled={true}
        
          loadingEnabled
          customMapStyle={mapStyle} // Apply dark map style
        >
          {/* Driver Marker */}
          <Marker coordinate={currentJob?.currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
           <View style={styles.markerContainer}>
                <Icon
                  name="taxi"
                  size={25}
                  color="red"
                  backgroundColor="white"
                  style={styles.taxiIcon}
                />
                <View style={styles.pinBottom} />
              </View>
          </Marker>

          
      
          <Marker
            coordinate={dropoffCoords}
            title="Dropoff"
            description={currentJob.dropoffLocation}
            pinColor="#FF5722" // Red
          >
            <Icon name="flag-checkered" size={30} color="#FF5722" />
          </Marker>
        </MapView>
        </>
        
        

        
      ) : (
        <ActivityIndicator style={styles.mapLoadingIndicator} size="large" color="#007AFF" />
      )}
     
      {/* Dynamic Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        {showArrivedButton && (
          <TouchableOpacity style={[styles.actionButton, styles.arrivedButton]} onPress={handleArrivedAtPickup}>
            <Icon name="map-marker-check" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Arrived at Pickup</Text>
          </TouchableOpacity>
        )}
        {showStartButton && (
          <TouchableOpacity style={[styles.actionButton, styles.startButton]} onPress={handleStartRide}>
            <Icon name="play-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Start Ride</Text>
          </TouchableOpacity>
        )}
        {showCompleteButton && (
          <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={handleCompleteJob}>
            <Icon name="check-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Complete Job</Text>
          </TouchableOpacity>
        )}
        {showCancelButton && (
          <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancelJob}>
            <Icon name="close-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Cancel Job</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default JobTrackingScreen;

const mapStyle = [
  // Dark map style JSON (you can find more online or customize)
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
    flex: 1,
    backgroundColor: '#000',
    paddingTop: StatusBar.currentHeight+30,
  },
    navigationButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },pinBottom: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'red',
    marginBottom: -3, // Adjust to overlap slightly with the icon
  },
   markerContainer: {
    alignItems: 'center',
  },
  taxiIcon: {
    borderRadius: 50,
    padding: 5,
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#330000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  sosButtonText: {
    color: '#FF5722',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  meterPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.9)',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  meterBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  meterLabel: {
    fontSize: 13,
    color: '#ccc',
    fontWeight: '500',
  },
  meterValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Bold' : 'sans-serif-medium',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#444',
  },
  etaPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(30,30,30,0.9)',
    paddingVertical: 8,
    marginHorizontal: 15,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  etaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  etaText: {
    color: '#ADD8E6',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCardContainer: {
    flexGrow: 0, // Allow content to scroll, but card itself doesn't take full height
    maxHeight: 250, // Max height for the scrollable info card
    marginHorizontal: 15,
    marginTop: 10,
  },
  infoCard: {
    backgroundColor: 'rgba(25,25,25,0.95)',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  riderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  riderName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  riderPhone: {
    color: '#ccc',
    fontSize: 14,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  contactButton: {
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#555',
  },
  tripDetails: {
    paddingTop: 10,
  },
  locationBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  locationLabel: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    width: 60,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  navigateButton: {
    padding: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(33, 150, 243, 0.2)', // Blue with transparency
  },
  notesBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.1)', // Gold with transparency
    borderRadius: 8,
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
  map: {
    flex: 1,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden', // Ensure border radius applies
    borderWidth: 1,
    borderColor: '#333',
  },
  mapLoadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  arrivedButton: {
    backgroundColor: '#4CAF50', // Green
  },
  startButton: {
    backgroundColor: '#2196F3', // Blue
  },
  completeButton: {
    backgroundColor: '#FF5722', // Red
  },
  cancelButton: {
    backgroundColor: '#607D8B', // Grey-blue
  },
});
