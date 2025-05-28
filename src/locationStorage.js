import { AsyncStorage } from 'react-native';

const LOCATION_KEY = '@driver_locations';

export const storeLocation = async location => {
  try {
    const storedLocations = await getStoredLocations();
    storedLocations.push({
      ...location,
      timestamp: new Date().toISOString(),
      synced: false,
    });
    await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(storedLocations));
  } catch (error) {
    console.error('Error storing location:', error);
  }
};

export const getStoredLocations = async () => {
  try {
    const locations = await AsyncStorage.getItem(LOCATION_KEY);
    return locations ? JSON.parse(locations) : [];
  } catch (error) {
    console.error('Error getting locations:', error);
    return [];
  }
};

export const markLocationsAsSynced = async () => {
  try {
    const locations = await getStoredLocations();
    const updated = locations.map(loc => ({ ...loc, synced: true }));
    await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error marking locations as synced:', error);
  }
};

export const clearSyncedLocations = async () => {
  try {
    const locations = await getStoredLocations();
    const unsynced = locations.filter(loc => !loc.synced);
    await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(unsynced));
  } catch (error) {
    console.error('Error clearing synced locations:', error);
  }
};