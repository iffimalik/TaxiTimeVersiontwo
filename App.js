import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import DriverStack from './src/navigation/DriverStack';
import { ShiftProvider } from './src/context/ShiftContext';
import { navigationRef } from './src/navigation/navigationService';

import NetInfo from '@react-native-community/netinfo';
import useJobStore from './src/store/jobStore'; // adjust path as needed
import { cleanupOldFirebaseNodes } from './src/services/cleanup'; // we'll create this
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/showToast';

export default function App() {
  useEffect(() => {
    // 🔄 Listen for internet changes and update Zustand store
    const unsubscribe = NetInfo.addEventListener((state) => {
      useJobStore.getState().setIsOnline(state.isConnected);
    });
      // boot();
    // 🧹 Clean up old Firebase node once
    // cleanupOldFirebaseNodes();

    return () => {
      unsubscribe();
    };

  }, []);
const boot = async () => {
  // const unsubscribe = NetInfo.addEventListener((state) => {
  //   useJobStore.getState().setIsOnline(state.isConnected);
  // });

  await useJobStore.getState().initializeJobFromFirebase();
};
  
  return (
    <ShiftProvider>
      <NavigationContainer ref={navigationRef}>
        <DriverStack />
      </NavigationContainer>
         {/* ✅ Toast Component Must Be Mounted */}
      <Toast config={toastConfig} />
    </ShiftProvider>
  );
}
