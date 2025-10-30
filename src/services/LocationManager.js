import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import useLocationStore from '../store/locationStore';

const { LocationModule } = NativeModules;

class LocationManager {
    constructor() {
        this.eventEmitter = new NativeEventEmitter(LocationModule);
        this.locationSubscription = null;
        this.isRunning = false;
    }

    startTracking() {
        if (Platform.OS === 'android' && !this.isRunning) {
            this.locationSubscription = this.eventEmitter.addListener(
                'locationUpdate',
                (location) => {
                    // Update location store
                    useLocationStore.getState().updateLocation({
                        latitude: location.latitude,
                        longitude: location.longitude,
                        accuracy: location.accuracy,
                        speed: location.speed, // Already in km/h from native module
                        heading: location.heading,
                        timestamp: location.timestamp,
                    });
                }
            );

            LocationModule.startLocationService()
                .then(() => {
                    this.isRunning = true;
                    console.log('Native location service started');
                })
                .catch(error => {
                    console.error('Failed to start location service:', error);
                });
        }
    }

    stopTracking() {
        if (Platform.OS === 'android' && this.isRunning) {
            if (this.locationSubscription) {
                this.locationSubscription.remove();
                this.locationSubscription = null;
            }

            LocationModule.stopLocationService()
                .then(() => {
                    this.isRunning = false;
                    console.log('Native location service stopped');
                })
                .catch(error => {
                    console.error('Failed to stop location service:', error);
                });
        }
    }
}

export default new LocationManager();