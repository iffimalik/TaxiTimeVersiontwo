import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import DriverStack from './src/navigation/DriverStack';
import { ShiftProvider } from './src/context/ShiftContext';

export default function App() {
  return (
    <ShiftProvider>
      <NavigationContainer>
        <DriverStack />
      </NavigationContainer>
    </ShiftProvider>
  );
}
