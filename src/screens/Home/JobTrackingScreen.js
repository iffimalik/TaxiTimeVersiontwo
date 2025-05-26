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
import MapView, { Marker, Polyline } from 'react-native-maps';
 
import Vehicle3D from './Vehicle3D';

// Location.configure({
//   distanceFilter: 5,
//   androidProvider: 'standard',
//   desiredAccuracy: {
//     android: 'highAccuracy',
//     ios: 'bestForNavigation',
//   },
//   interval: 1000,
//   fastestInterval: 500,
//   maxWaitTime: 10000,
// });

const JobTrackingScreen = ({ route }) => {
  const { job } = route.params || {};

  const [currentPosition, setCurrentPosition] = useState(null);
  const [distanceTravelled, setDistanceTravelled] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [vehicleHeading, setVehicleHeading] = useState(0);

  const locationSubscription = useRef(null);
  const timer = useRef(null);
  const currentPositionRef = useRef(null);
  const pickupTime = job?.pickupTime ? new Date(job.pickupTime) : new Date();

  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

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

  const startTracking = async () => {
    try {
      // const permission = await Location.requestPermission({
      //   ios: 'whenInUse',
      //   android: { detail: 'fine' },
      // });

      // if (!permission) {
      //   Alert.alert('Permission Denied', 'Location access is required.');
      //   return;
      // }

      // const initialLocation = await Location.getLatestLocation({ timeout: 10000 });
      // if (initialLocation) setCurrentPosition(initialLocation);

      // locationSubscription.current = Location.subscribeToLocationUpdates(
      //   (locations) => {
      //     const newPos = locations[0];
      //     if (newPos && newPos.heading !== undefined) {
      //       setVehicleHeading(newPos.heading);
      //     }

      //     if (currentPositionRef.current) {
      //       const dist = haversineDistance(currentPositionRef.current, newPos);
      //       setDistanceTravelled((prev) => prev + dist);
      //     }

      //     setCurrentPosition(newPos);
      //   }
      // );

      timer.current = setInterval(() => {
        const secondsPassed = Math.floor(
          (Date.now() - pickupTime.getTime()) / 1000
        );
        setElapsedTime(secondsPassed);
      }, 1000);
    } catch (err) {
      console.error('startTracking error:', err);
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current();
      locationSubscription.current = null;
    }
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    Alert.alert('Tracking Stopped');
  };

  useEffect(() => {
    if (!job?.destinationLat || !job?.destinationLng) {
      Alert.alert('Invalid job data');
      return;
    }
    startTracking();

    return () => stopTracking();
  }, []);

  const calculatePrice = () => {
    const km = distanceTravelled / 1000;
    const price = km * 1 + (elapsedTime / 60) * 0.5;
    return price.toFixed(2);
  };

  return (
    <View style={styles.container}>
      <View style={styles.meterPanel}>
            <View style={styles.meterBlock}>
                <Text style={styles.meterLabel}>⏱</Text>
                <Text style={styles.meterValue}>{Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.meterBlock}>
                <Text style={styles.meterLabel}>📍</Text>
                <Text style={styles.meterValue}>{(distanceTravelled / 1000).toFixed(2)} km</Text>
            </View>

            <View style={styles.divider} />

            <View style={[styles.meterBlock, styles.highlightBlock]}>
                <Text style={styles.meterLabel}>💰</Text>
                <Text style={[styles.meterValue, styles.price]}>QAR {calculatePrice()}</Text>
            </View>
            </View>


      {currentPosition ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          region={{
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
        >
          <Marker
            coordinate={{
              latitude: currentPosition.latitude,
              longitude: currentPosition.longitude,
            }}
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

          {/* <Polyline
            coordinates={[
              {
                latitude: currentPosition.latitude,
                longitude: currentPosition.longitude,
              },
              {
                latitude: job.destinationLat,
                longitude: job.destinationLng,
              },
            ]}
            strokeColor="#007AFF"
            strokeWidth={4}
          /> */}
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
  marginTop: 40,
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
