import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  Button,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Vehicle3D from './Vehicle3D';
import useLocationStore from '../../store/locationStore'; // adjust path
import useJobStore from '../..//store/jobStore';
import haversine from 'haversine-distance';


const JobTrackingScreen = ({ route }) => {
  const { job } = route.params || {};

  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const [distanceTravelled, setDistanceTravelled] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [vehicleHeading, setVehicleHeading] = useState(0);
    const { currentJob, jobStatus } = useJobStore.getState();

  const pickupTime = job?.pickupTime ? new Date(job.pickupTime) : new Date();
  const currentPositionRef = useRef(null);
  const timer = useRef(null);
  const tariff = {
    StartPrice: 4.0,
    ForFirst: 1000,
    DistanceRate: 4.0,
    PerDistance: 1000,
    TimeRate: 1.0,
    PerTime: 60,
    WaitingRate: 1.0,
    Perwating: 60
  };


     

  useEffect(() => {
    if (!currentJob.driver_job_start_time) return;

    const startTime = new Date(currentJob.driver_job_start_time).getTime();

    // Update elapsed time every second
    const interval = setInterval(() => {
      const now = Date.now();
      const diffSeconds = Math.floor((now - startTime) / 1000);
      setElapsedTime(diffSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentJob.driver_job_start_time]);

    const haversineDistance = (coords1, coords2) => {
    try {
      const toRad = (x) => (x * Math.PI) / 180;
      const R = 6378137;
      const dLat = toRad(coords2.latitude - coords1.latitude);
      const dLon = toRad(coords2.longitude - coords1.longitude);
      const lat1 = toRad(coords1.latitude);
      const lat2 = toRad(coords2.latitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    } catch (error) {
      console.error('Distance error:', error);
      return 0;
    }
  };

  // useEffect(() => {
  //   // Set timer for elapsed time
  //   timer.current = setInterval(() => {
  //     const secondsPassed = Math.floor((Date.now() - pickupTime.getTime()) / 1000);
  //     setElapsedTime(secondsPassed);
  //   }, 1000);

  //   return () => {
  //     clearInterval(timer.current);
  //   };
  // }, []);

  useEffect(() => {
    if (!latitude || !longitude) return;

    const newPos = { latitude, longitude };

    if (currentPositionRef.current) {
      const dist = haversineDistance(currentPositionRef.current, newPos);
      setDistanceTravelled((prev) => prev + dist);
    }

    currentPositionRef.current = newPos;

     const latDiff = latitude - currentPositionRef.current.latitude;
   const lonDiff = longitude - currentPositionRef.current.longitude;

   const heading = Math.atan2(lonDiff, latDiff) * (180 / Math.PI);
    setVehicleHeading(heading);
    
  }, [latitude, longitude]);

  const stopTracking = () => {
    clearInterval(timer.current);
    Alert.alert('Tracking Stopped');
  };
  const culculatePrice = () => { 
    const price = culculatePrice1(
  currentJob.coordinateHistory,
  currentJob.driver_job_start_time,
  tariff
    );
    return price || '0.00';

  }
const culculatePrice1 = (coordinateHistory, driverJobStartTime, tariff) => {
  if (!coordinateHistory || coordinateHistory.length < 2) return tariff?.StartPrice?.toFixed(2) || '0.00';

  // 1. Calculate Total Distance
  let totalDistanceMeters = 0;
  for (let i = 1; i < coordinateHistory.length; i++) {
    const prev = coordinateHistory[i - 1];
    const curr = coordinateHistory[i];

    totalDistanceMeters += haversine(
      { lat: prev.latitude, lon: prev.longitude },
      { lat: curr.latitude, lon: curr.longitude }
    );
  }

  // 2. Calculate Elapsed Time in Seconds
  const jobStartTime = new Date(driverJobStartTime);
  const now = new Date();
  const elapsedTimeSeconds = (now - jobStartTime) / 1000;

  // 3. Price Calculation
  let price = tariff.StartPrice;

  const additionalDistance = Math.max(totalDistanceMeters - tariff.ForFirst, 0);
  const distanceUnits = additionalDistance / tariff.PerDistance;
  price += distanceUnits * tariff.DistanceRate;

  const timeUnits = elapsedTimeSeconds / tariff.PerTime;
  price += timeUnits * tariff.TimeRate;

  return price.toFixed(2);
};

  const currentPosition = latitude && longitude ? { latitude, longitude } : null;
 

  const heading = currentPosition
    ? Math.atan2(
        currentPosition.longitude - (currentPositionRef.current?.longitude || longitude),
        currentPosition.latitude - (currentPositionRef.current?.latitude || latitude)
      ) * (180 / Math.PI)
    : 0;
 
  return (
    <View style={styles.container}>
      <View style={styles.meterPanel}>
        <View style={styles.meterBlock}>
          <Text style={styles.meterLabel}>⏱</Text>
          <Text style={styles.meterValue}>
            {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.meterBlock}>
          <Text style={styles.meterLabel}>📍</Text>
          <Text style={styles.meterValue}>{(distanceTravelled / 1000).toFixed(2)} km</Text>
        </View>

        <View style={styles.divider} />

        <View style={[styles.meterBlock, styles.highlightBlock]}>
          <Text style={styles.meterLabel}>💰</Text>
          <Text style={[styles.meterValue, styles.price]}>QAR {culculatePrice()}</Text>
        </View>
      </View>

      {currentPosition ? (
        <MapView
          style={styles.map}
          region={{
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
        >
          <Marker
            coordinate={currentPosition}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Vehicle3D color="#FF5722" heading={vehicleHeading} />
          </Marker>

          <Marker
            coordinate={{
              latitude: job.destinationLat,
              longitude: job.destinationLng,
            }}
            title="Drop-Off"
            pinColor="green"
          />
        </MapView>
      ) : (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#007AFF" />
      )}

      <View style={styles.stopButtonContainer}>
        <Button title="Stop Tracking" onPress={stopTracking} color="#FF3B30" />
      </View>
    </View>
  );
};

export default JobTrackingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
        backgroundColor: '#000',
      marginTop: StatusBar.currentHeight,
  },
  meterPanel: {
    backgroundColor: '#1a1a1a',
 
    paddingHorizontal: 20,
    borderBottomColor: '#444',
    borderBottomWidth: 1,
    borderRadius: 0,
    shadowColor: '#000',
    elevation: 10,
    zIndex: 10,
  },
  meterText: {
    color: '#eee',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    textAlign: 'center',
    },
    meterPanel: {
  // marginTop: 40,
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
  backgroundColor: 'rgba(20,20,20,0.85)',
  paddingVertical: 14,
  paddingHorizontal: 20,
  borderRadius: 12,
  marginHorizontal: 15,
  shadowColor: '#000',
  shadowOpacity: 0.4,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 10,
},

meterBlock: {
  alignItems: 'center',
  flexDirection: 'row',
  gap: 6,
},

meterLabel: {
  fontSize: 20,
  color: '#ccc',
},

meterValue: {
  fontSize: 18,
  fontWeight: '600',
  color: '#fff',
  fontFamily: 'Courier', // gives digital dashboard feel
},

price: {
  color: '#00E676', // bright green
  fontWeight: '700',
  fontSize: 18,
},

divider: {
  width: 1,
  height: 25,
  backgroundColor: '#444',
},

highlightBlock: {
  backgroundColor: '#121212',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
},

  price: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  map: {
    flex: 1,
  },
  stopButtonContainer: {
    padding: 15,
    backgroundColor: '#fff',
  },
});
