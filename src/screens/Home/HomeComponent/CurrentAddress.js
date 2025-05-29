import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import useLocationStore from '../../../store/locationStore';
import CarIcon from './carSvg'; // your SVG car icon component
import { Animated } from 'react-native';

const LocationDisplay = () => {
  const { latitude, longitude, heading = 0 } = useLocationStore(); 
  // assuming heading in degrees (0 = North, 90 = East, etc.)
  const [locationName, setLocationName] = useState('');
      const changeCounter = useRef(0);
  const lastCoords = useRef({ lat: null, lng: null });

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      const hasLocationChanged = (
        lastCoords.current.lat !== latitude ||
        lastCoords.current.lng !== longitude
      );

      if (hasLocationChanged) {
        changeCounter.current += 1;
        lastCoords.current = { lat: latitude, lng: longitude };
      }

      if (changeCounter.current % 100 === 0) {
        const fetchLocationName = async () => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const displayName = data.display_name || 'Unknown location';
            setLocationName(displayName);
            console.log('Location Name:', displayName);
          } catch (error) {
            console.log('Error fetching address:', error.message);
            setLocationName('Unable to fetch location');
          }
        };

        fetchLocationName();
      }
    }
  }, [latitude, longitude]);

  if (latitude === null || longitude === null) {
    return <Text style={styles.loadingText}>Fetching location...</Text>;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        <Marker coordinate={{ latitude, longitude }} title="You are here">
          {/* Rotate CarIcon by heading degrees */}
          <Animated.View style={{ transform: [{ rotate: `${heading}deg` }] }}>
            <CarIcon size={40} color="#d32f2f" />
          </Animated.View>
        </Marker>
      </MapView>
      <Text style={styles.addressText}>
        {locationName || 'Fetching address...'}
      </Text>
    </View>
  );
};

export default LocationDisplay;
const styles = StyleSheet.create({
  container: {
     
    padding: 10,
  },
  map: {
    width: Dimensions.get('window').width - "10%" ,
    height: Dimensions.get('window').height * 0.1,
     
  },
  addressText: {
    fontSize: 14,
    color: '#555',
    marginTop: 10,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#2f80ed',
    textAlign: 'center',
    marginTop: 20,
  },
});