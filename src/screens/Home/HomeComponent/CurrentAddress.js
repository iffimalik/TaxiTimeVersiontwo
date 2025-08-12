import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Alert, Animated, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useLocationStore from '../../../store/locationStore';
// Removed PROVIDER_GOOGLE import as we are no longer using it for tiles
import MapView, { Marker, UrlTile } from 'react-native-maps'; // Import UrlTile for custom tile server
// CarIcon is not used in the provided snippet's JSX, so it's kept as-is or can be removed if truly unused.
// import CarIcon from './carSvg';

const { width, height } = Dimensions.get('window');
const SPACING_HORIZONTAL = width * 0.04;
const CAR_JUMP_GIF_URL = './marker.png'; // This path needs to be resolved for actual image use

// Define the OpenStreetMap tile URL template
// This is a common and generally free-to-use OSM tile server.
// Always check the usage policies of any tile server you use, especially for high-volume apps.
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const LocationDisplay = () => {
  const { latitude, longitude, heading = 0 } = useLocationStore();
  const [locationName, setLocationName] = useState('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const mapRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const lastFetchedCoords = useRef({ lat: null, lng: null });
  const jumpAnim = useRef(new Animated.Value(0)).current;

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
      // Using Nominatim for reverse geocoding, which is also part of OpenStreetMap ecosystem and free for reasonable use.
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
      mapRef.current.animateCamera(
        {
          center: {
            latitude,
            longitude,
          },
          heading: parseInt(heading || 0),
          pitch: 55,
          zoom: 15,
          altitude: 500,
        },
        { duration: 1000 }
      );
    }
  }, [latitude, longitude, heading]);

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        fetchLocationName(latitude, longitude);
      }, 130000); // Increased debounce time for address fetching

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

  const handleRetry = useCallback(() => {
    if (latitude !== null && longitude !== null) {
      fetchLocationName(latitude, longitude);
    } else {
      Alert.alert('Location Unavailable', 'Cannot retry without valid GPS coordinates.');
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
const STADIA_MAPS_ALIDADE_SMOOTH = 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
    
        cacheEnabled={false}
        style={styles.map}
        initialRegion={{
          latitude: latitude,
          longitude: longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
 
        showsBuildings={false}
        pitchEnabled={true}
        zoomEnabled
        scrollEnabled
        rotateEnabled
        zoomControlEnabled
        zoomTapEnabled
        // loadingEnabled
       
        showsCompass={false}
        showsMyLocationButton={false}
        showsUserLocation={false}
        showsTraffic={false}
        showsScale={false}
        showsIndoors={false}
        showsIndoorLevelPicker={false}
        showsPointsOfInterest={false}
      >
{/*     
        <UrlTile
          urlTemplate={OSM_TILE_URL}
          zIndex={-1} // Ensure tiles are rendered below markers
        /> */}

         <UrlTile
          urlTemplate={STADIA_MAPS_ALIDADE_SMOOTH}
          zIndex={-1}
        />
        <Marker
          coordinate={{ latitude, longitude }}
          flat={true}
          anchor={{ x: 0.5, y: 0.5 }}
        >
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
        onPress={fetchError ? handleRetry : null}
        activeOpacity={fetchError ? 0.7 : 1}
      >
        <Icon name="map-marker-outline" size={20} color="#ADD8E6" />
        <Text style={styles.addressText}>
          {isFetchingAddress && !fetchError ? 'Fetching address...' : `${locationName} ${latitude},${longitude}`}
        </Text>
        {isFetchingAddress && !fetchError && <ActivityIndicator size="small" color="#ADD8E6" style={styles.spinner} />}
        {fetchError && (
          <Icon name="alert-circle-outline" size={20} color="#FF5722" style={styles.errorIcon} />
        )}
      </TouchableOpacity>
    </View>
  );
};

// Remove the minimalRoadMapStyle as it's specifically for Google Maps' styling API.
// const minimalRoadMapStyle = [...] // DELETE THIS CONST

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
  },
  pinBottom: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'red',
    marginBottom: -3,
  },
  taxiIcon: {
    borderRadius: 50,
    padding: 5,
  },
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
    borderRadius: 15,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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