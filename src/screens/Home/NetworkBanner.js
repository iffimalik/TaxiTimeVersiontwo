import React, { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { View, Text, StyleSheet } from 'react-native';

const NetworkBanner = () => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>🚫 No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FF3B30',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 999,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default NetworkBanner;
