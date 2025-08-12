import React, { useState, useCallback , useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
} from '../../utils/showToast';
import api from '../../services/api';
import { ENDPOINTS } from '../../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { update } from '@react-native-firebase/database';
const { width } = Dimensions.get('window');
import { ShiftContext } from '../../context/ShiftContext';
const SPACING = 24;

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const insets = useSafeAreaInsets();
const {  setDriver , setVehicles   } = useContext(ShiftContext);

  const togglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible(!isPasswordVisible);
  }, [isPasswordVisible]);

//   const handleLogin = useCallback(async () => {
//     if (!email.trim() || !password) {
//       showInfoToast('Missing Fields', 'Please enter both email and password.');
//       return;
//     }

//     setLoading(true);
//     try {
//       // await auth().signInWithEmailAndPassword(email, password);
//       // setLoading(false);
//       // showSuccessToast('Success', 'Logged in successfully!');
//       setLoading(true);
// console.log('🟡 Starting login process...');

//         setLoading(true);
// console.log('🟡 Starting login process...');

// auth()
//   .signInWithEmailAndPassword(email, password)
//   .then((userCredential) => {
//     console.log('✅ Firebase login successful:', userCredential.user?.email);

//     const userData = {
//       email: userCredential.user?.email,
//       uid: userCredential.user?.uid,
//     };
    
//     console.log('🟡 Fetching driver data from backend API...');
//     return api.post(ENDPOINTS.LOGIN_DRIVER, {
//             email,
//             password,
//           });
//   })
//   .then(async (response) => {
//     console.log('✅ Driver data fetched:', response);
 



//               try {
//                  let DriverId = response.driverId || '1';
//                   console.log('🟡 Fetching vehicles for driver ID:', DriverId);
//                 const response_vehicle = await api.get(ENDPOINTS.DRIVER_ASSIGN_VEHICLE(DriverId));
//                 console.log('✅ Vehicles fetched successfully:', JSON.stringify(response_vehicle));

//                 AsyncStorage.setItem('DriverVehicles', JSON.stringify(response_vehicle))
              
                
//               } catch (error) {
//                 console.error('Error fetching vehicles:', error);
//                 showErrorToast('Error', 'Failed to fetch vehicles. Please try again later.');
//               }

//               return AsyncStorage.setItem('DriverData', JSON.stringify(response)).then(() => {
//                 console.log('🟢 User data stored in AsyncStorage:', JSON.stringify(response));
//               });

 
 
 
 




//   })
//   .then(() => {
//     showSuccessToast('Success', 'Logged in successfully!');
 
//   })
//   .catch((error) => {
//     console.error('❌ Login Error:', error);
//     showErrorToast('Login failed', error.message || 'Something went wrong.');
//   })
//   .finally(() => {
//     console.log('ℹ️ Login process ended. Resetting loading state.');
//     setLoading(false);
//   });





//       // Navigation will be handled by auth state changes typically
//     } catch (error) {
//       setLoading(false);
//       showErrorToast('Login failed', error.message);
//     }
//   }, [email, password, navigation]);
const handleLogin = useCallback(async () => {
  if (!email.trim() || !password) {
    showInfoToast('Missing Fields', 'Please enter both email and password.');
    return;
  }

  setLoading(true);
  // console.log('🟡 Starting login process...');

  try {
    // Step 1: Firebase Auth
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    // console.log('✅ Firebase login successful:', userCredential.user?.email);

    // Step 2: Backend Driver Login
    // console.log('🟡 Fetching driver data from backend API...');
    const driverResponse = await api.post(ENDPOINTS.LOGIN_DRIVER, { email, password });

    const driverData = driverResponse; // Adjust based on your actual response structure
    const driverId = driverResponse?.driverId || '1'; // fallback if needed
        let token = driverResponse?.token;
    await AsyncStorage.setItem('authToken', token);
    let driverDetail = driverResponse?.driverObject;
    await AsyncStorage.setItem('driverDetail', JSON.stringify(driverDetail));
    if (!driverId) throw new Error('Driver ID not found in response');

    // console.log('✅ Driver data fetched:', driverData);

    // Step 3: Fetch Assigned Vehicles
    // console.log('🟡 Fetching vehicles for driver ID:', driverId);
    const vehicleResponse = await api.get(ENDPOINTS.DRIVER_ASSIGN_VEHICLE(driverId));
    const vehicles = vehicleResponse // adjust if it's wrapped in .data

    // console.log('✅ Vehicles fetched successfully:', JSON.stringify(vehicles));
    try {
          await setDriver(driverData); // Assuming you have a function to update driver data in your context or state
          await setVehicles(vehicles); // Assuming you have a function to update vehicle data in your context or state
    } catch (error) {
      console.error('Error updating context with driver and vehicles:', error);
      showErrorToast('Error', 'Failed to update driver and vehicles. Please try again later.');
    }

    // Step 5: Success toast
    showSuccessToast('Success', 'Logged in successfully!');
  } catch (error) {
    console.error('❌ Login Error:', error);
    showErrorToast('Login failed', error.message || 'Something went wrong.');
  } finally {
    console.log('ℹ️ Login process ended. Resetting loading state.');
    setLoading(false);
  }
}, [email, password , navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top + SPACING, paddingBottom: insets.bottom + SPACING }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Icon name="email-outline" size={20} color="#777" style={styles.inputIcon} />
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            editable={!loading}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock-outline" size={20} color="#777" style={styles.inputIcon} />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!isPasswordVisible}
            style={styles.input}
            editable={!loading}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
            <Icon name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, (loading || !email.trim() || !password) && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading || !email.trim() || !password}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={loading} style={styles.registerButton}>
          <Text style={styles.registerText}>Don't have an account? <Text style={styles.registerLink}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Dark background
    paddingHorizontal: SPACING,
    justifyContent: 'center',
  },
  header: {
    marginBottom: SPACING * 1.5,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525', // Darker input background
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    backgroundColor: '#2196F3', // Blue login button
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: '#607D8B',
    shadowOpacity: 0.2,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  registerButton: {
    marginTop: 25,
    alignItems: 'center',
  },
  registerText: {
    color: '#ccc',
    fontSize: 15,
  },
  registerLink: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
});

export default LoginScreen;