import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Platform,
  Alert,
  Image,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Location from 'react-native-location';
import Vehicle3D from './Vehicle3D';

Location.configure({
  distanceFilter: 5,
  androidProvider: 'standard',
  desiredAccuracy: {
    android: 'highAccuracy',
    ios: 'bestForNavigation',
  },
  interval: 5000,
  fastestInterval: 2000,
  maxWaitTime: 10000,
});

const JobTrackingScreen = ({ route }) => {
  const { job } = route.params || {};

  const [currentPosition, setCurrentPosition] = useState(null);
  const [distanceTravelled, setDistanceTravelled] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
      const [vehicleHeading, setVehicleHeading] = useState(0);

  const locationSubscription = useRef(null);
  const timer = useRef(null);
  const currentPositionRef = useRef(null);

  const pickupTime = job?.pickupTime ? new Date(job.pickupTime) : null;

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
      console.error('Error in haversineDistance:', error);
      return 0;
    }
  };
 
  const startTracking = async () => {
    try {
      const permission = await Location.requestPermission({
        ios: 'whenInUse',
        android: { detail: 'fine' },
      });

      if (!permission) {
        Alert.alert('Permission Denied', 'Cannot use GPS without permission.');
        return;
      }

      const location = await Location.getLatestLocation({ timeout: 10000 });
      if (location) {
        setCurrentPosition(location);
      }

      locationSubscription.current = Location.subscribeToLocationUpdates(
        (locations) => {
              const newPos = locations[0];
               
         if (newPos && newPos.heading !== undefined) {
                    setVehicleHeading(newPos.heading); // use useState for heading
            }

          if (currentPositionRef.current) {
            const dist = haversineDistance(
              currentPositionRef.current,
              newPos
            );
            setDistanceTravelled((prev) => prev + dist);
          }
          setCurrentPosition(newPos);
        }
      );

      timer.current = setInterval(() => {
        if (pickupTime) {
          const secondsPassed = Math.floor(
            (Date.now() - pickupTime.getTime()) / 1000
          );
          setElapsedTime(secondsPassed);
        }
      }, 1000);
    } catch (error) {
      console.error('startTracking error:', error);
      Alert.alert('Tracking Error', error.message);
    }
  };

  useEffect(() => {
    if (!job || !job.destinationLat || !job.destinationLng) {
      Alert.alert('Missing job details');
      return;
    }

    startTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current();
        locationSubscription.current = null;
      }
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, []);

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

  const calculatePrice = () => {
    try {
      const km = distanceTravelled / 1000;
      const price = km * 1 + (elapsedTime / 60) * 0.5;
      return price.toFixed(2);
    } catch (err) {
      console.error('calculatePrice error:', err);
      return '0.00';
    }
  };

  return (
    <View style={styles.container}>
     <View style={styles.meter}>
        <Text style={styles.meterText}>⏱ {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s</Text>
        <Text style={styles.meterText}>  |  📍 {(distanceTravelled / 1000).toFixed(2)} km</Text>
        <Text style={[styles.meterText, styles.price]}>  |  💰 QAR {calculatePrice()}</Text>
        </View>


      {/* Map */}
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
          showsUserLocation={false}
        >
          {/* Driver Marker */}
          <Marker
            coordinate={{
                latitude: currentPosition?.latitude || 0,
                longitude: currentPosition?.longitude || 0,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            >
            <Vehicle3D color="#FF5722" heading={vehicleHeading} />
            </Marker>

          {/* Destination Marker */}
          <Marker
            coordinate={{
              latitude: job.destinationLat,
              longitude: job.destinationLng,
            }}
            title="Drop-Off"
            pinColor="green"
          />

          {/* Route Line */}
          <Polyline
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
          />
        </MapView>
      ) : (
        <Text style={styles.loadingText}>Fetching location...</Text>
      )}

      <Button title="Stop Tracking" onPress={stopTracking} color="#FF3B30" />
    </View>
  );
};

export default JobTrackingScreen;

const styles = StyleSheet.create({
    container: {
        marginTop: "10%",
    flex: 1,
    backgroundColor: '#fff',
  },
  meter: {
      backgroundColor: '#f0f0f0',
    
    padding: 15,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  meterText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  map: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
    color: 'gray',
    },
  meter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',        // dark background like a meter screen
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  meterText: {
    color: '#eee',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Courier New',     // monospace for that meter vibe
  },
  price: {
    color: '#FFD700',               // golden/yellow highlight for price
    fontWeight: 'bold',
  },
});
