import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Alert, Animated, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useLocationStore from '../../../store/locationStore';
import MapView, { Marker } from 'react-native-maps';
import CarIcon from './carSvg';

const { width, height } = Dimensions.get('window');
const SPACING_HORIZONTAL = width * 0.04;
const CAR_JUMP_GIF_URL = './marker.png';

const LocationDisplay = () => {
  const { latitude, longitude, heading = 0 } = useLocationStore();
  const [locationName, setLocationName] = useState('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const mapRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const lastFetchedCoords = useRef({ lat: null, lng: null });
  const jumpAnim = useRef(new Animated.Value(0)).current; // For potential additional animation

  const fetchLocationName = useCallback(async (lat, lon) => {
    if (isFetchingAddress) return;

    const COORD_TOLERANCE = 0.00001;
    if (
      lastFetchedCoords.current.lat !== null &&
      lastFetchedCoords.current.lng !== null &&
      Math.abs(lastFetchedCoords.current.lat - lat) < COORD_TOLERANCE &&
      Math.abs(lastFetchedCoords.current.lng - lon) < COORD_TOLERANCE
    ) {
      return;
    }

    setIsFetchingAddress(true);
    setFetchError(null);
    setLocationName('Fetching address...');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const displayName = data.display_name || 'Unknown location';
      setLocationName(displayName);
      lastFetchedCoords.current = { lat, lng: lon };
    } catch (error) {
      console.error('Error fetching address:', error.message);
      setFetchError('Failed to fetch address');
      setLocationName('Tap to retry');
    } finally {
      setIsFetchingAddress(false);
    }
  }, [isFetchingAddress]);

  useEffect(() => {
    if (latitude !== null && longitude !== null && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        fetchLocationName(latitude, longitude);
      }, 130000);

      return () => {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
      };
    } else {
      setLocationName('Fetching GPS location...');
      setFetchError(null);
      setIsFetchingAddress(true);
    }
  }, [latitude, longitude, fetchLocationName]);

  

  if (latitude === null || longitude === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#ADD8E6" />
        <Text style={styles.loadingText}>Fetching GPS location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView 
        ref={mapRef}
        style={styles.map}
           initialRegion={{
             latitude: latitude,
            longitude: longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
            showsUserLocation={true} // We'll use a custom marker
            zoomEnabled={true}
        scrollEnabled={true}
        rotateEnabled={true}
        pitchEnabled={true}
          region={{ // Keep map centered on current location
            latitude: latitude,
            longitude: longitude,
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
      >
          <Marker
                    coordinate={{ latitude, longitude }}
                    title="Your Location"
                    pinColor="green"
       >
        </Marker>  
                  
        {/* <Marker
          coordinate={{ latitude, longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat={true}
          rotation={heading}
        >
         
          
            <Image
              source={{ uri: CarIcon }}
              style={{ width: 60, height: 60, resizeMode: 'contain' }}
            />
          
        </Marker> */}
      </MapView>
      <TouchableOpacity
        style={styles.addressContainer}
        onPress={fetchError ? null : null}
        activeOpacity={fetchError ? 0.7 : 1}
      >
        <Icon name="map-marker-outline" size={20} color="#ADD8E6" />
        <Text style={styles.addressText}>
          {isFetchingAddress && !fetchError ? 'Fetching address...' : locationName}
        </Text>
        {isFetchingAddress && !fetchError && <ActivityIndicator size="small" color="#ADD8E6" style={styles.spinner} />}
        {fetchError && (
          <Icon name="alert-circle-outline" size={20} color="#FF5722" style={styles.errorIcon} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(30,30,30,0.8)',
  },
  map: {

     marginTop: 10,
    width: width - 2 * SPACING_HORIZONTAL,
    height: height * 0.1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 20,
    borderColor: 'red',
    shadowColor: 'white',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.8)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    width: width - 2 * SPACING_HORIZONTAL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    gap: 10,
    justifyContent: 'center',
  },
  addressText: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.8)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    width: width - 2 * SPACING_HORIZONTAL,
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    color: '#ADD8E6',
    textAlign: 'center',
    flex: 1,
  },
  spinner: {
    marginLeft: 10,
  },
  errorIcon: {
    marginLeft: 5,
  },
});

export default LocationDisplay;