import React, { useEffect, useRef, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
  UIManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useJobStore from './../../store/jobStore'; // Adjust path if necessary
import { showErrorToast, showSuccessToast, showConfirmationToast } from '../../utils/showToast';
import { changeRideStatus } from '../../utils/common';
import { ShiftContext } from '../../context/ShiftContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Enable LayoutAnimation for Android for smoother UI transitions
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// --- Constants for Responsive Design and Theming ---
const { width } = Dimensions.get('window');
const SPACING = width * 0.045; // Base spacing unit for responsive design
const ACCENT_COLOR_PAUSED = '#FFC107'; // Amber/Orange for paused state and highlights
const ACCENT_COLOR_PRIMARY = '#007AFF'; // Blue for 'Continue' button
const ACCENT_COLOR_SECONDARY = '#4CAF50'; // Green for 'Complete' button
const TEXT_COLOR_LIGHT = '#E0E0E0'; // Light grey for primary text
const TEXT_COLOR_MUTED = '#95A5A6'; // Muted grey for secondary text/subtitles
const CARD_BG_COLOR = 'rgba(25,25,25,0.95)'; // Slightly transparent dark card background
const BG_COLOR_PRIMARY = '#121212'; // Primary dark background color

// --- Utility Function for Time Formatting ---
/**
 * Formats a total number of seconds into HH:MM:SS string format.
 * @param {number} totalSeconds - The total number of seconds.
 * @returns {string} Formatted time string (e.g., "01:23:45").
 */
const formatSecondsToHMS = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const JobPausedScreen = () => {
  const navigation = useNavigation();
  const { currentJob, setJobStatus, updateCurrentJob, clearJob } = useJobStore();
  const { driver } = useContext(ShiftContext);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- Animation for screen entry ---
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500, // Duration of the fade-in animation
      useNativeDriver: true, // Use native driver for performance
    }).start();

    // Defensive check: If job data is invalid, navigate away to prevent issues.
    if (!currentJob || !currentJob.id) {
      showErrorToast('Error', 'No active job to resume or complete. Returning to dashboard.');
      navigation.replace('Home'); // Navigate to a safe screen like Home.
    }
  }, [fadeAnim, currentJob, navigation]);

  // --- Action Handlers ---

  /**
   * Handles resuming the job. Updates job status to 'started' and manages pause records.
   */
  const handleContinueJob = useCallback(async () => {
    if (!currentJob || !currentJob.id || !driver?.driverId || !driver?.token) {
      showErrorToast('Error', 'Job or driver details missing. Cannot continue.');
      return;
    }

    const now = new Date().toISOString(); // Current timestamp for job resume time

    // Create a mutable copy of pause_records to update
    let updatedPauseRecords = [...(currentJob?.pause_records || [])];

    // Find the last pause record that hasn't been resumed yet (resumedAt is null).
    let lastUnresumedPauseIndex = -1;
    for (let i = updatedPauseRecords.length - 1; i >= 0; i--) {
      if (updatedPauseRecords[i].resumedAt === null) {
        lastUnresumedPauseIndex = i;
        break;
      }
    }

    if (lastUnresumedPauseIndex !== -1) {
      const lastPauseRecord = updatedPauseRecords[lastUnresumedPauseIndex];
      const pausedAtTime = new Date(lastPauseRecord.pausedAt).getTime();
      const resumedAtTime = new Date(now).getTime();
      // Calculate the duration of the pause in seconds.
      const durationSeconds = Math.floor((resumedAtTime - pausedAtTime) / 1000);

      // Update the specific pause record with resume time and duration.
      updatedPauseRecords[lastUnresumedPauseIndex] = {
        ...lastPauseRecord,
        resumedAt: now,
        durationSeconds: durationSeconds,
      };
    } else {
      // Log a warning if no unresumed pause record is found, indicating potential data inconsistency.
      console.warn('Attempted to resume job but no unresumed pause record found. This might indicate a logic or data issue.');
      // Depending on your application's error handling, you might choose to
      //  - Show an error to the user
      //  - Add a new "partial" record (less ideal)
      // For now, we proceed to resume the job, assuming it's an edge case.
    }

    try {
      // Prepare the job object with the new status and updated pause records to send to the backend.
      const jobDataForStatusChange = {
        ...currentJob,
        status: 'started', // Set the new status to 'started'
        pause_records: updatedPauseRecords, // Include the fully updated pause records
        resume_time: now, // Also track the general last resume time on the job object
      };

      // Call the common utility to change ride status, updating the backend.
      await changeRideStatus(
        'started',
        currentJob.id,
        driver.driverId,
        driver.token,
        jobDataForStatusChange // Pass the complete updated job object for backend synchronization
      );

      // Update local store states after successful backend update.
      setJobStatus('started'); // Update global job status (e.g., for UI state)
      updateCurrentJob(jobDataForStatusChange , 'handleContinueJob'); // Update local job details with all changes (pause records, status)
      showSuccessToast('Job Resumed', 'You are back on track!');
      // Navigate back to the previous screen (presumably the active job screen).
      // navigation.goBack();

    } catch (error) {
      console.error('Error resuming job:', error);
      showErrorToast('Error', 'An unexpected error occurred while resuming the job. Please try again.');
    }
  }, [currentJob, driver, setJobStatus, updateCurrentJob, navigation]);

  /**
   * Handles completing the job from the paused state.
   * Presents a confirmation dialog before finalizing the job.
   */
  const handleCompleteJob = useCallback(() => {
    showConfirmationToast({
      title: 'Complete Job',
      message: 'Are you sure you want to complete this job? This action cannot be undone.',
      confirmText: 'Yes, Complete',
      cancelText: 'No',
      confirmType: 'default',
      onConfirm: async () => {
        if (!currentJob || !currentJob.id || !driver?.driverId || !driver?.token) {
          showErrorToast('Error', 'Job or driver details missing. Cannot complete.');
          return;
        }
        try {
          // Call the common utility to change ride status to 'completed'.
          await changeRideStatus('completed', currentJob.id, driver.driverId, driver.token, currentJob);
         
          setJobStatus('completed'); // Update global job status
          updateCurrentJob({ complete_job_time: new Date().toISOString(), status: 'completed' }, 'handleCompleteJob'); // Update local job details with completion time and status;
          // Optionally, clear the job from jobStore if it's considered fully done and no longer needed in state.
          // clearJob(); 
          showSuccessToast('Job Completed', 'The job has been successfully finalized!');
          // navigation.replace('Home'); // Navigate to the Home screen or a job summary screen.
           
        } catch (error) {
          console.error('Error completing job from paused state:', error);
          showErrorToast('Error', 'An unexpected error occurred while completing the job.');
        }
      },
    });
  }, [currentJob, driver, setJobStatus, updateCurrentJob, clearJob, navigation]);

  // --- Render nothing if job data is missing to prevent errors ---
  if (!currentJob || !currentJob.id) {
    return null;
  }

  // Extract and format job statistics for display
  const distanceKm = (currentJob?.pricingBreakdown.totalDistance / 1000 || 0).toFixed(2);
  const waitingTimeSeconds = currentJob?.totalAccumulatedWaitingSeconds || 0;
  const waitingCost = currentJob?.pricingBreakdown.waitingCost || 0;
   const timeCost = currentJob?.pricingBreakdown.durationCost || 0;
  const distanceCost = currentJob?.pricingBreakdown.distanceCost || 0;
  const earnings = currentJob?.pricingBreakdown.totalCost || 0;
  const formattedWaitingTime = formatSecondsToHMS(waitingTimeSeconds);
 

  return (
    <View style={styles.container}>
      {/* Status bar configuration for a consistent dark theme */}
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR_PRIMARY} />
      
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <View style={styles.iconContainer}>
          <Icon name="pause-circle-outline" size={80} color={ACCENT_COLOR_PAUSED} />
        </View>
        <Text style={styles.title}>Job Paused</Text>
        <Text style={styles.subtitle}>
          Your current job has been paused.
          {'\n'}
          Please choose to continue or complete the job.
        </Text>

        {/* --- Job Statistics Section --- */}
        <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Icon name="map-marker-distance" size={20} color={TEXT_COLOR_LIGHT} />
              <Text style={styles.statLabel}>Distance:</Text>
              <Text style={styles.statValue}>{distanceKm} KM</Text>
            </View>
          <View style={styles.statItem}>
            <Icon name="currency-usd" size={20} color={TEXT_COLOR_LIGHT} />
            <Text style={styles.statLabel}>Time Fare:</Text>
            <Text style={styles.statValue}>${timeCost}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="currency-usd" size={20} color={TEXT_COLOR_LIGHT} />
            <Text style={styles.statLabel}>Distance Fare:</Text>
            <Text style={styles.statValue}>${distanceCost}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="currency-usd" size={20} color={TEXT_COLOR_LIGHT} />
            <Text style={styles.statLabel}>Waiting Fare:</Text>
            <Text style={styles.statValue}>${waitingCost}</Text>
          </View>
           
          <View style={styles.statItem}>
            <Icon name="currency-usd" size={20} color={TEXT_COLOR_LIGHT} />
            <Text style={styles.statLabel}>Fare So Far:</Text>
            <Text style={styles.statValue}>${earnings}</Text>
          </View>
        </View>
        {/* --- End Job Statistics Section --- */}

        <View style={styles.buttonContainer}>
          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.continueButton]}
            onPress={handleContinueJob}
            activeOpacity={0.8}
            accessibilityLabel="Continue Job"
            testID="continueJobButton" // Added for testing
          >
            <Icon name="play-circle-outline" size={24} color={TEXT_COLOR_LIGHT} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>

          {/* Complete Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleCompleteJob}
            activeOpacity={0.8}
            accessibilityLabel="Complete Job"
            testID="completeJobButton" // Added for testing
          >
            <Icon name="check-circle-outline" size={24} color={TEXT_COLOR_LIGHT} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Complete</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR_PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING,
  },
  card: {
    backgroundColor: CARD_BG_COLOR,
    borderRadius: 20,
    padding: SPACING * 2,
    width: width * 0.9,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 15,
    borderLeftWidth: 6,
    borderLeftColor: ACCENT_COLOR_PAUSED, // Left border highlight for paused state
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: SPACING,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: ACCENT_COLOR_PAUSED, // Title in the accent color for paused
    marginBottom: SPACING * 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_COLOR_MUTED,
    marginBottom: SPACING * 1.5,
    textAlign: 'center',
    lineHeight: 22,
  },
  // --- New Styles for Job Statistics ---
  statsContainer: {
    width: '100%',
    paddingVertical: SPACING,
    marginBottom: SPACING * 1.5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Distribute items with space between
    paddingVertical: SPACING * 0.5,
    // Add horizontal padding to stat items to match card padding
    paddingHorizontal: SPACING * 0.5, // Adjusted for visual balance
  },
  statLabel: {
    fontSize: 15,
    color: TEXT_COLOR_MUTED,
    fontWeight: '600',
    flex: 1, // Allow label to take available space
  },
  statValue: {
    fontSize: 16,
    color: TEXT_COLOR_LIGHT,
    fontWeight: 'bold',
    marginLeft: SPACING * 0.5, // Space between label and value
  },
  // --- End New Styles for Job Statistics ---
  buttonContainer: {
    flexDirection: 'column', // Stack buttons vertically
    width: '100%',
    gap: SPACING * 0.8, // Space between buttons
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING * 1.2,
    borderRadius: 30, // Rounded button corners
    width: '100%', // Full width within card
    shadowColor: '#000', // Shadow for depth
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10, // Android elevation
    gap: SPACING * 0.5, // Space between icon and text
  },
  continueButton: {
    backgroundColor: ACCENT_COLOR_PRIMARY, // Blue background for continue
  },
  completeButton: {
    backgroundColor: ACCENT_COLOR_SECONDARY, // Green background for complete
  },
  buttonIcon: {
    // No specific style needed here, already handled by size and color
  },
  buttonText: {
    color: TEXT_COLOR_LIGHT,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default JobPausedScreen;