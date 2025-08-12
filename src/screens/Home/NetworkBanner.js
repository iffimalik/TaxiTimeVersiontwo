import React, { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { View, Text, StyleSheet } from 'react-native';
import useJobStore from '../../store/jobStore'; // Assuming path to your job Zustand store

const NetworkBanner = () => {
  const [isConnected, setIsConnected] = useState(true);

  // Correct way to get a Zustand action: use the hook directly or from getState().action
  // If `setIsOnline` is a setter function directly on the store's state,
  // it's cleaner to get it directly like this from `useJobStore`.
  const setIsOnline = useJobStore(state => state.setIsOnline);

  useEffect(() => {
    // 1. Initial check: Get current network status right away
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
      setIsOnline(state.isConnected); // Set initial online status in store
    });

    // 2. Subscribe to future network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const currentConnectionStatus = state.isConnected;
      setIsConnected(currentConnectionStatus);
      setIsOnline(currentConnectionStatus); // Update store with current status
    });

    // 3. Cleanup function: Unsubscribe when the component unmounts
    return () => unsubscribe();
  }, [setIsOnline]); // Dependency array: Re-run if setIsOnline function itself changes (rare, but good practice)
  
  // Only render the banner if there's no internet connection
  if (isConnected) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>🚫 No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FF3B30', // Red for offline status
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // position: 'absolute',
    // top: 0,
    width: '100%',
    zIndex: 999, // Ensure it's on top of other content
  },
  text: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default NetworkBanner;