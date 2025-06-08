import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Alert, Animated, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useLocationStore from '../../../store/locationStore';
import MapView, { Marker , PROVIDER_GOOGLE } from 'react-native-maps';
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
      {/* <MapView 
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
                  
       
      </MapView> */}
       <MapView
           ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
              latitude: latitude,
            longitude: longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsBuildings={true} 
          pitchEnabled={true} 
          zoomEnabled
          scrollEnabled
          rotateEnabled
         
          zoomControlEnabled
          zoomTapEnabled
          loadingEnabled
          // customMapStyle={mapStyle}
          showsCompass
          showsMyLocationButton
          showsUserLocation={true} // we're using custom marker
          showsTraffic={false}
          showsScale={false}
          showsIndoors={false}
          showsIndoorLevelPicker={false}
          showsPointsOfInterest={false}
        >
          {/* Driver Marker */}
            <Marker  coordinate={{ latitude, longitude }}
            flat={true}
              // rotation={currentJob?.heading} // ← yes sir, point the damn car the right way
              anchor={{ x: 0.5, y: 0.5 }}>
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

         
        </MapView>
      <TouchableOpacity
        style={styles.addressContainer}
        onPress={fetchError ? null : null}
        activeOpacity={fetchError ? 0.7 : 1}
      >
        <Icon name="map-marker-outline" size={20} color="#ADD8E6" />
        <Text style={styles.addressText}>
          {isFetchingAddress && !fetchError ?  latitude+', '+ longitude : locationName}
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
    margin: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(30,30,30,0.8)',
     borderWidth: 2,
    borderColor: 'rgba(155, 145, 145, 0.8)',
    overflow: 'hidden',
  },
  map: {
  marginTop: 10,
  width: width - 2 * SPACING_HORIZONTAL,
  height: height * 0.20,
  borderRadius: 15, // slightly more for a nice round
  marginBottom: 10,
  overflow: 'hidden', // crucial for clipping the child (map)
  // Remove borderWidth unless necessary
  // borderWidth: 20,
  // borderColor: 'red',
  shadowColor: '#000', // optional: keep or adjust shadow if needed
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5, // for Android shadow
},

  // map: {

  //    marginTop: 10,
  //   width: width - 2 * SPACING_HORIZONTAL,
  //   height: height * 0.20,
    

  //   borderRadius: 10,
  //   marginBottom: 10,
  //   overflow: 'hidden',
  //   borderWidth: 20,
  //   borderColor: 'red',
  //   shadowColor: 'white',
  // },
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