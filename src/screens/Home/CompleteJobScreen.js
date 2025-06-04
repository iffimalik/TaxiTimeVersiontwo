import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Dimensions, // For responsiveness
  Animated,   // For animations
  LayoutAnimation, // For subtle layout changes
  UIManager, // For LayoutAnimation on Android
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { database } from './../../services/firebase'; // Assuming Firebase Realtime Database
import useJobStore from './../../store/jobStore'; // adjust path as needed
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // For icons
import { showErrorToast, showSuccessToast } from '../../utils/showToast';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Get screen dimensions for responsiveness
const { width, height } = Dimensions.get('window');
const SPACING = width * 0.05; // 5% of screen width for general spacing

const CompleteJobScreen = ({ route }) => {
  const { job } = route.params; // Get job details from route params
  const navigation = useNavigation();
  const { currentJob, setCurrentJob, setJobStatus, updateCurrentJob, clearJob } = useJobStore();
  const fadeAnim = useRef(new Animated.Value(0)).current; // For fade-in animation
  const confettiAnim = useRef(new Animated.Value(0)).current; // For confetti-like animation (scale)

  // --- Initial Setup and Animations ---
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Confetti animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(confettiAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(confettiAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ensure job data is available from route params
    if (!job || !job.id) {
      // Alert.alert('Error', 'Job details not found. Returning to home.');
      showErrorToast('Error', 'Job details not found. Returning to home.');
      navigation.replace('Home');
    }
  }, [fadeAnim, confettiAnim, job, navigation]);

  const handleFinish = useCallback(async () => {
    LayoutAnimation.easeInEaseOut(); // Animate layout changes
    try {
      // Update job status in store
      setJobStatus('finished');
      const finished_time = new Date().toISOString();
      updateCurrentJob({ finished_time, status: 'finished' });

      const jobId = job?.id; // Use job from route params
      if (jobId) {
        // Clear job from Firebase Realtime Database (if applicable)
        // Ensure 'database()' is correctly initialized and has write permissions
        await database().ref(`jobs/${jobId}`).set(null);
        console.log(`Job ${jobId} removed from Firebase.`);
      }

      // Clear offline job from AsyncStorage
      await AsyncStorage.removeItem('offlineJob');
      console.log('Offline job cleared from AsyncStorage.');

      // Clear current job from global state and reset status
      clearJob(); // This should set currentJob to null and jobStatus to 'pending'

      // Alert.alert('Job Completed', 'Thank you for completing the ride!');
      showSuccessToast('Job Completed', 'Thank you for completing the ride!');
      // await changeRideStatus('completed', currentJob?.id, driver.driverId, driver.token);
      navigation.replace('Home'); // Navigate back to Home screen
    } catch (err) {
      console.error('Error completing job:', err.message);
      // Alert.alert('Error', 'Failed to complete the job. Please try again.');
      showErrorToast('Error', 'Failed to complete the job. Please try again.');
    }
  }, [job, setJobStatus, updateCurrentJob, clearJob, navigation]);

  // Render nothing if job data is missing (should be caught by useEffect)
  if (!job || !job.id) {
    return null;
  }

  // Helper for consistent label-value display
  const LabelValue = ({ icon, label, value, color }) => (
    <View style={styles.sectionItem}>
      <Icon name={icon} size={20} color={color || '#ADD8E6'} />
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );

  return (
    <Animated.ScrollView contentContainerStyle={styles.container} style={{ opacity: fadeAnim }}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.card}>
        {/* Animated Confetti Icon */}
        <Animated.View style={[
          styles.confettiIconContainer,
          { transform: [{ scale: confettiAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 1.2, 1] // Scale up and down
          }) }] }
        ]}>
          <Icon name="check-decagram" size={60} color="#4CAF50" />
        </Animated.View>

        <Text style={styles.title}>🎉 Job Completed!</Text>
        <Text style={styles.subtitle}>Great job on your ride!</Text>

        <View style={styles.divider} />

        <LabelValue icon="identifier" label="Job ID" value={job.id} />
        <LabelValue icon="map-marker-outline" label="Pickup" value={job.pickupLocation} />
        <LabelValue icon="flag-checkered" label="Dropoff" value={job.dropoffLocation} />

        <View style={styles.earningsSection}>
          <Icon name="cash-multiple" size={30} color="#FFD700" />
          <View>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsValue}>QAR {parseFloat(job.earningsSoFar || 0).toFixed(2)}</Text>
          </View>
        </View>

        <LabelValue
          icon="map-marker-distance"
          label="Distance"
          value={`${(job.distanceTravelled / 1000 || 0).toFixed(2)} km`}
        />
        <LabelValue
          icon="clock-outline"
          label="Duration"
          value={job.estimatedDuration || 'N/A'} // Assuming job has estimatedDuration
        />
        <LabelValue
          icon="account-circle"
          label="Rider"
          value={job.riderName || 'N/A'}
        />

        <TouchableOpacity style={styles.finishButton} onPress={handleFinish} activeOpacity={0.7}>
          <Icon name="home-outline" size={24} color="#fff" style={styles.finishButtonIcon} />
          <Text style={styles.finishButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#1a1a1a', // Dark background
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING,
  },
  card: {
    backgroundColor: 'rgba(25,25,25,0.95)', // Darker card background
    borderRadius: 20,
    padding: SPACING * 1.2,
    width: width * 0.9, // 90% of screen width
    maxWidth: 400, // Max width for larger screens
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50', // Green accent
    alignItems: 'center', // Center content inside card
  },
  confettiIconContainer: {
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 20,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    width: '80%',
    marginVertical: 20,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 15,
    width: '100%', // Take full width of card
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    width: 80, // Fixed width for labels for alignment
  },
  value: {
    fontSize: 16,
    color: '#fff',
    flex: 1, // Allow value text to wrap
  },
  earningsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)', // Gold transparent background
    padding: 15,
    borderRadius: 15,
    marginVertical: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFD700',
    gap: 15,
  },
  earningsLabel: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 5,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60', // Green
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 30,
    width: '80%', // Make button responsive
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 15,
    gap: 10,
  },
  finishButtonIcon: {
    marginRight: 5,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CompleteJobScreen;
