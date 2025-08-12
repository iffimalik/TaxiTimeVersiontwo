import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import DriverStack from './src/navigation/DriverStack';
import { ShiftProvider } from './src/context/ShiftContext';
import { TarrifProvider } from './src/context/TarrifContext';
import { StripeProvider } from '@stripe/stripe-react-native';

import KeepAwake from 'react-native-keep-awake';

import { navigationRef } from './src/navigation/navigationService';

import NetInfo from '@react-native-community/netinfo';
import useJobStore from './src/store/jobStore';
// import { cleanupOldFirebaseNodes } from './src/services/cleanup'; // This import is not used
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/showToast';
import { JobProvider } from './src/context/jobContext';
// import useLocationStore from './src/store/locationStore'; // This import seems unused in App.js
// import { startService } from './src/BackgroundService'; // This import seems unused in App.js

import { WebSocketProvider } from './src/context/WebSocketContext'; // <--- NEW IMPORT

export default function App() {
  // Removed unused useLocationStore state variables from here as they are not directly used in App.js logic
  // const { isBackgroundServiceRunning , latitude, longitude} = useLocationStore();

  useEffect(() => {
    // 🔒 Keep screen awake
    KeepAwake.activate();

    // 🔄 Listen for internet changes and update Zustand store
    const unsubscribe = NetInfo.addEventListener((state) => {
      useJobStore.getState().setIsOnline(state.isConnected);
    });

    // You had commented this out, but typically you'd start the service here
    // based on certain conditions if it's not managed solely by the WebSocket hook.
    // if (!isBackgroundServiceRunning) {
    //   startService();
    // }

    return () => {
      unsubscribe();
      KeepAwake.deactivate(); // 💤 Allow sleep on unmount
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  return (
    <StripeProvider
      publishableKey="pk_test_snO3BkhQgYmzMBKFTN1i82Ch" // Replace with your key
      // urlScheme="your-app-scheme" // Required for 3D Secure, Apple Pay, etc.
      // merchantIdentifier="merchant.com.your-app-name" // Required for Apple Pay
    >
      <TarrifProvider>
        <ShiftProvider>
          {/* WebSocketProvider must wrap JobProvider because JobProvider needs access to sendWebSocketMessage */}
          <WebSocketProvider>
            <JobProvider>
              <NavigationContainer ref={navigationRef}>
                <DriverStack />
              </NavigationContainer>
              <Toast config={toastConfig} />
            </JobProvider>
          </WebSocketProvider>
        </ShiftProvider>
      </TarrifProvider>
    </StripeProvider>
  );
}