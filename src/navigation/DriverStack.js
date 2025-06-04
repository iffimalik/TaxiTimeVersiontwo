import React, { useEffect, useState, useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import JobTrackingScreen from '../screens/Home/JobTrackingScreen';
import StartShiftScreen from '../screens/Home/StartShiftScreen';
import JobAcceptScreen from '../screens/Home/Job/AcceptJobScreen';

import { ShiftContext } from '../context/ShiftContext';
import CompleteJobScreen from '../screens/Home/CompleteJobScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import DetailedChatScreen from '../screens/Chat/DetailedChatScreen';
const Stack = createNativeStackNavigator();

const DriverStack = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const { shiftStarted } = useContext(ShiftContext);

useEffect(() => {
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
      {!user  ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : !shiftStarted ? (
        <Stack.Screen name="StartShiftScreen" component={StartShiftScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="JobTrackingScreen" component={JobTrackingScreen} />
          <Stack.Screen name="AcceptJobScreen" component={JobAcceptScreen} />
          <Stack.Screen name="CompleteJobScreen" component={CompleteJobScreen} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="DetailedChatScreen" component={DetailedChatScreen} />
          
        </>
      )}
    </Stack.Navigator>
  );
};

export default DriverStack;
