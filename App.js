import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import DriverStack from './src/navigation/DriverStack';
import { ShiftProvider } from './src/context/ShiftContext';
import { navigationRef } from './src/navigation/navigationService';

export default function App() {
  return (
    <ShiftProvider>
      <NavigationContainer   ref={navigationRef}>
        <DriverStack />
      </NavigationContainer>
    </ShiftProvider>
  );
}
