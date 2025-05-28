import { PermissionsAndroid, Platform } from 'react-native';

class LocationService {
    async checkPermissions() {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            ]);
            return (
                granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 
                PermissionsAndroid.RESULTS.GRANTED
            );
        }
        return true;
    }

    getCurrentPosition(options) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                { enableHighAccuracy: true, ...options }
            );
        });
    }

    watchPosition(callback, options) {
        return navigator.geolocation.watchPosition(
            callback,
            error => console.error('Location error:', error),
            { enableHighAccuracy: true, distanceFilter: 10, ...options }
        );
    }
}

export default new LocationService();