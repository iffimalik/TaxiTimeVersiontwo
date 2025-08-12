import React, { useEffect, useState, useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import JobTrackingScreen from '../screens/Home/JobTrackingScreen';
import StartShiftScreen from '../screens/Home/StartShiftScreen';
import TarrifSelectionScreen from '../screens/Home/TarrifSelectionScreen';
import JobAcceptScreen from '../screens/Home/Job/AcceptJobScreen';

import { ShiftContext } from '../context/ShiftContext';
import { TarrifContext } from '../context/TarrifContext';

import { JobContext } from '../context/jobContext';

import CompleteJobScreen from '../screens/Home/CompleteJobScreen';
import PauseJobScreen from '../screens/Home/JobPausedScreen';

import ChatScreen from '../screens/Chat/ChatScreen';
import DetailedChatScreen from '../screens/Chat/DetailedChatScreen';
import { stopService } from '../BackgroundService';
const Stack = createNativeStackNavigator();

const DriverStack = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const { shiftStarted } = useContext(ShiftContext);
  const { isTarrifSelected , isNeedtoRefresh , selectedTarrif } = useContext(TarrifContext);
  const { currentJob,  jobStatus, initializeJobFromFirebase } = useContext(JobContext);
  // console.log("🚀 ~ DriverStack ~ currentJob:", currentJob);
  useEffect(() => {
  
    // console.log("currentJob", currentJob);

    if (!user) {
      stopService()
    }

  const unsubscribe = auth().onAuthStateChanged((authUser) => {
    
    setUser(authUser);
    if (initializing) setInitializing(false);
  });
  return unsubscribe;
}, []);


 
  if (initializing) {
    return (
      <View style={{ flex:1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2f80ed" />
      </View>
    );
  }

  return (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {!user ? (
      <>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </>
    ) : !shiftStarted ? (
      <Stack.Screen name="StartShiftScreen" component={StartShiftScreen} />
    ) :  isNeedtoRefresh == false ? (
      <Stack.Screen name="TarrifSelectionScreen" component={TarrifSelectionScreen} />
    ) : currentJob != null && ['pending', 'accepted', 'on_the_way', 'arrived_ready', 'arrived' , 'sending' , 'displayed'].includes(jobStatus) ? (
      <Stack.Screen name="AcceptJobScreen" component={JobAcceptScreen} />
    ) : currentJob != null && jobStatus === 'started' ? (
      <Stack.Screen name="JobTrackingScreen" component={JobTrackingScreen}  initialParams={{ job: currentJob }} />
    ) : currentJob != null && jobStatus === 'completed' ? (
      <Stack.Screen name="CompleteJobScreen" component={CompleteJobScreen} initialParams={{ job: currentJob }}  />
    ) : currentJob != null && jobStatus === 'paused' ? (
      <Stack.Screen name="pauseJobScreen" component={PauseJobScreen} initialParams={{ job: currentJob }}  />
    ) : currentJob != null && ['finished', 'cancelled','noShow'].includes(jobStatus) ? (
      <Stack.Screen name="Home" component={HomeScreen} />
    ) : (
      <>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ChatScreen" component={ChatScreen} />
        <Stack.Screen name="DetailedChatScreen" component={DetailedChatScreen} />
      </>
    )}
  </Stack.Navigator>
);

};

export default DriverStack;
