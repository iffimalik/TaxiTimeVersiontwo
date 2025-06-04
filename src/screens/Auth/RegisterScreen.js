import React, { useState, useCallback , useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Import MaterialCommunityIcons
import { showInfoToast, showSuccessToast, showErrorToast } from '../../utils/showToast'; // Ensure showErrorToast is imported
import api from '../../services/api';
import { ENDPOINTS } from '../../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShiftContext } from '../../context/ShiftContext';
const { width } = Dimensions.get('window');
const SPACING = 24;

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const insets = useSafeAreaInsets();
const { shiftStarted, shiftStartTime, shiftCloseTime, startShift, endShift, selectedVehicle, setSelectedVehicle ,  driver, setDriver , setVehicles   } = useContext(ShiftContext);

  const togglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible(!isPasswordVisible);
  }, [isPasswordVisible]);

  const handleRegister = useCallback(async () => {
    if (!email.trim()) {
      showInfoToast('Validation', 'Please enter your email');
      return;
    }
    if (!password) {
      showInfoToast('Validation', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      

       setLoading(true); // Start loading

// console.log('🟡 Starting user registration with Firebase...');
auth()
  .createUserWithEmailAndPassword(email, password)
  .then((userCredential) => {
    // console.log('✅ Firebase registration successful:', userCredential.user?.email);
          
          // console.log('🟡 Sending user data to backend API...');
          return api.post(ENDPOINTS.REGISTER_DRIVER, {
            email,
            password,
          });
        })
        .then(async (response) => {
          // console.log('✅ Backend registration successful:', response);
          
         

          // console.log('🟡 Storing user data in AsyncStorage...');
           try {
                 
                

                let DriverId = response.driverId || '1';
                  // console.log('🟡 Fetching vehicles for driver ID:', DriverId);
                const vehicleData = await api.get(ENDPOINTS.DRIVER_ASSIGN_VEHICLE(DriverId));
                // console.log('✅ Vehicles fetched successfully:', vehicleData);

                // AsyncStorage.setItem('DriverVehicles', JSON.stringify(response1))
               await setDriver(response); // Assuming you have a function to update driver data in your context or state
              await setVehicles(vehicleData); 
                
              } catch (error) {
                console.error('Error fetching vehicles:', error);
                showErrorToast('Error', 'Failed to fetch vehicles. Please try again later.');
              }
         
          showSuccessToast('Success', 'Account created successfully!');
          // navigation.navigate('Login');
        })
        .catch((error) => {
          console.error('❌ Registration Error:', error);
          showErrorToast('Registration Error', error.message || 'Something went wrong.');
        })
        .finally(() => {
          console.log('ℹ️ Registration process ended. Resetting loading state.');
          setLoading(false);
        });

    } catch (error) {
      setLoading(false);
      showErrorToast('Registration Error', error.message);
    }
  }, [email, password, navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + SPACING, paddingBottom: insets.bottom + SPACING },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Your Account</Text>
          <Text style={styles.subtitle}>Join us to get started!</Text>
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
              placeholderTextColor="#999" // Placeholder color for dark theme
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
              placeholderTextColor="#999" // Placeholder color for dark theme
            />
            <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
              <Icon name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={loading || !email.trim() || !password} // Disable if fields are empty
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading} style={styles.loginButton}>
            <Text style={styles.loginText}>Already have an account? <Text style={styles.loginLink}>Login</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Allows content to grow and be scrollable
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
    color: '#fff', // White text for dark theme
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc', // Lighter grey for subtitle
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
    borderColor: '#333', // Darker border
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
    color: '#fff', // White text for input
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    backgroundColor: '#4CAF50', // Green for register button
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#4CAF50', // Green shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: '#607D8B', // Grey-blue when disabled
    shadowOpacity: 0.2,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 25,
    alignItems: 'center',
  },
  loginText: {
    color: '#ccc', // Lighter grey for text
    fontSize: 15,
  },
  loginLink: {
    color: '#2196F3', // Blue for the link
    fontWeight: 'bold',
  },
});

export default RegisterScreen;