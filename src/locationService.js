import Geolocation from 'react-native-geolocation-service';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { Platform, PermissionsAndroid } from 'react-native';
import { store } from './store'; // Assuming you have a Redux or Zustand store

class LocationService {
  constructor() {
    this.isTracking = false;
    this.locationSubscribers = new Set();
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      return (
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED ||
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    }
  }

  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => resolve(position),
        error => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
          distanceFilter: 0,
          showLocationDialog: true,
        }
      );
    });
  }

  startBackgroundTracking() {
    if (this.isTracking) return;

    BackgroundGeolocation.configure({
      desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
      distanceFilter: 10,
      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      notificationTitle: 'Tracking your location',
      notificationText: 'Active',
      debug: false,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    });

    BackgroundGeolocation.on('location', location => {
      this.handleNewLocation(location);
    });

    BackgroundGeolocation.start();
    this.isTracking = true;
  }

  stopBackgroundTracking() {
    BackgroundGeolocation.stop();
    this.isTracking = false;
  }

  handleNewLocation(location) {
    // Update store with new location
    store.dispatch({
      type: 'UPDATE_LOCATION',
      payload: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        timestamp: location.timestamp,
      },
    });

    // Notify all subscribers
    this.locationSubscribers.forEach(callback => callback(location));
  }

  subscribe(callback) {
    this.locationSubscribers.add(callback);
    return () => this.locationSubscribers.delete(callback);
  }
}

export const locationService = new LocationService();