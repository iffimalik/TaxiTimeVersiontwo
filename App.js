import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import DriverStack from './src/navigation/DriverStack';
import { ShiftProvider } from './src/context/ShiftContext';
import { TarrifProvider } from './src/context/TarrifContext';

import KeepAwake from 'react-native-keep-awake';

import { navigationRef } from './src/navigation/navigationService';

import NetInfo from '@react-native-community/netinfo';
import useJobStore from './src/store/jobStore'; // adjust path as needed
import { cleanupOldFirebaseNodes } from './src/services/cleanup'; // we'll create this
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/showToast';
import { JobProvider } from './src/context/jobContext';

export default function App() {
  useEffect(() => {

        // 🔒 Keep screen awake
    KeepAwake.activate();
    // 🔄 Listen for internet changes and update Zustand store
    const unsubscribe = NetInfo.addEventListener((state) => {
      useJobStore.getState().setIsOnline(state.isConnected);
    });
      // boot();
    // 🧹 Clean up old Firebase node once
    // cleanupOldFirebaseNodes();

    return () => {
      unsubscribe();
      KeepAwake.deactivate(); // 💤 Allow sleep on unmount
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
      <TarrifProvider>
      <JobProvider> 
        {/* 🧭 Navigation Container with ref for navigation service */}
      <NavigationContainer ref={navigationRef}>
       
            <DriverStack />
           
      </NavigationContainer>
         {/* ✅ Toast Component Must Be Mounted */}
          <Toast config={toastConfig} />
       </JobProvider>
     </TarrifProvider>
    </ShiftProvider>
  
  );
}
