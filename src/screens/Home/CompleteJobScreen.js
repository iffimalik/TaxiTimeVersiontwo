import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  Animated,
  LayoutAnimation,
  UIManager,
  SafeAreaView,
  Platform,
  Switch,
  Keyboard,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
 

import { useNavigation } from '@react-navigation/native';
import useJobStore from './../../store/jobStore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { showErrorToast, showSuccessToast, showInfoToast } from '../../utils/showToast';
import { changeRideStatus } from '../../utils/common';
import { ShiftContext } from '../../context/ShiftContext';
import moment from 'moment';
 import { 
  useStripe,
  initStripe, 
 
  initPaymentSheet, 
  StripeContainer,
  presentPaymentSheet 
} from '@stripe/stripe-react-native';
// --- Stripe SDK Integration ---
 
import api from '../../services/api';
import { JOBENDPOINT } from '../../utils/constants';
  // --- Handle Scan Card ---
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
// --- NFC Manager Integration ---
 
 

// Enable LayoutAnimation for Android for smooth state transitions
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// --- Constants for Responsive Design and Theming ---
const { width } = Dimensions.get('window');
const SPACING = width * 0.03; // Even smaller base spacing for a tighter layout
const CARD_PADDING_VERTICAL = SPACING * 1.0;
const CARD_PADDING_HORIZONTAL = SPACING * 1.2;

// Professional Dark Theme Palette
const COLOR_BACKGROUND = '#121212'; // Deep background
const COLOR_SURFACE = '#1C1C1C'; // Card/elevated surface background
const COLOR_ACCENT_PRIMARY = '#007AFF'; // Google-like Blue for primary actions/highlights
const COLOR_ACCENT_SECONDARY = '#4CAF50'; // Green for success/positive indicators
const COLOR_TEXT_PRIMARY = '#E0E0E0'; // Light grey for main text
const COLOR_TEXT_SECONDARY = '#95A5A6'; // Muted grey for labels/hints
const COLOR_INPUT_BACKGROUND = '#333333';
const COLOR_INPUT_BORDER = '#444444';
const COLOR_WARNING = '#FFD700'; // Gold for warnings/total fare display
const COLOR_ERROR = '#FF6347'; // Red for errors
const COLOR_BUTTON_RETURN = '#0A84FF'; // A slightly different blue for return to job

// --- Helper Functions ---
const formatCurrencyNZD = (amount) => {
  const value = parseFloat(amount);
  if (isNaN(value)) return '0.00';
  return value.toFixed(2);
};

const formatDistanceKm = (distanceMeters) => {
  const value = parseFloat(distanceMeters) / 1000; // Convert meters to km
  if (isNaN(value)) return '0.0 Km';
  return `${value.toFixed(1)} Km`;
};

const formatDurationSeconds = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00:00';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num) => String(Math.floor(num)).padStart(2, '0'); // Ensure integer for padding
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

// --- Reusable UI Components ---
const LabelValue = React.memo(({ icon, label, value, color, iconSize = 16, valueStyle = {} }) => (
  <View style={styles.sectionItem}>
    {icon && <Icon name={icon} size={iconSize} color={color || COLOR_TEXT_SECONDARY} style={styles.itemIcon} />}
    <View style={styles.labelValueContent}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueStyle]}>{value || 'N/A'}</Text>
    </View>
  </View>
));

const SectionHeader = React.memo(({ title, icon }) => (
  <View style={styles.sectionHeaderContainer}>
    {icon && <Icon name={icon} size={18} color={COLOR_ACCENT_SECONDARY} style={styles.sectionHeaderIcon} />}
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
));
// --- Permission Check Function ---
const checkPermissions = async () => {
  if (Platform.OS === 'android') {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, // Essential for location accuracy and Bluetooth scanning
      'android.permission.FOREGROUND_SERVICE',             // For background services (if applicable)
      PermissionsAndroid.PERMISSIONS.CAMERA,               // For card scanning via camera
      PermissionsAndroid.PERMISSIONS.NFC,                  // For NFC tap-to-pay
    ];

    // Add Android 12+ (API 31+) Bluetooth permissions
    if (Platform.Version >= 31) {
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
    } else { // For Android versions < 12 (API 31)
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN
      );
    }

    // Add POST_NOTIFICATIONS permission for Android 13 (API 33) and above.
    if (Platform.Version >= 33) {
      permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      const allGranted = permissions.every(
        p => granted[p] === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        showErrorToast('Permissions Required', 'Some essential permissions were not granted. Certain payment features may not work.');
      }
      return allGranted;

    } catch (err) {
      console.error('Android permission request error:', err);
      showErrorToast('Permission Error', 'Failed to request permissions. Please check app settings.');
      return false;
    }
  }
  // For iOS, permissions are handled slightly differently:
  // - Camera, NFC (NFCReaderUsageDescription), Bluetooth (NSBluetoothAlwaysUsageDescription, NSBluetoothPeripheralUsageDescription),
  //   and Location (NSLocationWhenInUseUsageDescription) are added to Info.plist.
  // - iOS often prompts for permissions when the feature is first accessed by an SDK (e.g., Stripe SDK for Camera, Core NFC for NFC).
  // - For Stripe Terminal on iOS, you'll also need specific entitlements.
  // As this function is Android-centric, we'll return true for iOS, assuming Info.plist setup and SDK handling.
  return true;
};
// --- CompleteJobScreen Component ---
const CompleteJobScreen = ({ route }) => {
  const navigation = useNavigation();
  const { currentJob, setJobStatus, updateCurrentJob, clearJob } = useJobStore();
  const { driver } = useContext(ShiftContext);
  let { scanCard } = useStripe(); 
  // --- Stripe Hook ---
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // --- Animation States ---
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- Form States ---
  const [totalMobilityChecked, setTotalMobilityChecked] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Cash');
  const [extraAmount, setExtraAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [reason, setReason] = useState('Service Charge');
  const [accountNumber, setAccountNumber] = useState('');
  const [giftCardNumber, setGiftCardNumber] = useState('');

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isReturningToJob, setIsReturningToJob] = useState(false);
  const [isStripeSheetLoading, setIsStripeSheetLoading] = useState(false);

  // Input focus states for dynamic styling
  const [extraInputFocused, setExtraInputFocused] = useState(false);
  const [discountInputFocused, setDiscountInputFocused] = useState(false);
  const [reasonInputFocused, setReasonInputFocused] = useState(false);
  const [accountInputFocused, setAccountInputFocused] = useState(false);
  const [giftCardInputFocused, setGiftCardInputFocused] = useState(false);

  // Ref to hold the dynamically calculated total fare
  const calculatedTotalFareRef = useRef(0.00);

  // --- Effects and Initial Load ---
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    //  checkPermissions(); // Example call
    if (!currentJob?.id) {
      showErrorToast('Error', 'Job details not found. Returning to home.');
      navigation.replace('Home');
    }
  }, [fadeAnim, currentJob, navigation]);

  useEffect(() => {
    if (!currentJob?.id || !currentJob?.pricingBreakdown) {
      // console.log("No current job or pricing breakdown found, skipping fare calculation.");
    handleReturnToJob();
      // updateCalculatedFare();
        
    }
  }, [currentJob]);


  // --- Calculate Dynamic Total Fare ---
  const updateCalculatedFare = useCallback(() => {
    let baseFare = parseFloat(currentJob?.pricingBreakdown?.totalCost || currentJob?.earningsSoFar || 0);
    const extra = parseFloat(extraAmount || 0);
    const discount = parseFloat(discountAmount || 0);

    if (totalMobilityChecked) {
      baseFare = baseFare / 2;
    }

    let newFare = baseFare + extra - discount;
    const finalFare = Math.max(0, newFare);

    LayoutAnimation.easeInEaseOut();
    calculatedTotalFareRef.current = finalFare;
  }, [currentJob, extraAmount, discountAmount, totalMobilityChecked]);

  useEffect(() => {
    updateCalculatedFare();
  }, [extraAmount, discountAmount, totalMobilityChecked, currentJob, updateCalculatedFare]);

  // --- Core Payment Finalization Logic ---
  const finalizeJobAndPayment = useCallback(async (paymentDetails) => {
    try {
      await changeRideStatus('finished', currentJob.id, driver.driverId, driver.token, {
        ...currentJob,
        paymentDetails: paymentDetails,
      });

      setJobStatus('finished');
      updateCurrentJob({
        finished_time: new Date().toISOString(),
        status: 'finished',
        paymentDetails: paymentDetails
      },'finishedJob');
      clearJob();

      showSuccessToast('Payment Recorded', `NZD${paymentDetails.amount} collected via ${paymentDetails.method}.`);
      // navigation.replace('Home');
    } catch (err) {
      console.error('Error recording payment:', err.message);
      showErrorToast('Error', 'Failed to record payment. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  }, [currentJob, driver, setJobStatus, updateCurrentJob, clearJob, navigation]);

  // --- Stripe Payment Sheet Handler ---
  const handleProcessWithStripeSheet = useCallback(async (finalFare) => {
    setIsStripeSheetLoading(true);
    try {
      const apiResponse = await api.post(JOBENDPOINT.GET_STRIPE_CREATE_PAYMENT_INTENT, {
        amount: finalFare,
        currency: 'nzd',
        rideId: currentJob?.id,
      }, {
       
          Authorization: `Bearer ${driver.token}`,
       
      });

      if (!apiResponse || !apiResponse || !apiResponse.clientSecret || !apiResponse.ephemeralKey || !apiResponse.customerId) {
        throw new Error('Invalid response structure from backend payment intent endpoint.');
      }

      const { clientSecret, ephemeralKey, customerId } = apiResponse;

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Taxi Time NZ',
        customerId: customerId,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          name: currentJob?.riderName || 'Guest Rider',
          email: currentJob?.riderEmail || 'email@example.com',
        },
        primaryButtonColor: COLOR_ACCENT_PRIMARY,
      });

      if (initError) {
        showErrorToast('Payment Setup Error', initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          showInfoToast('Payment Canceled', 'Card payment was canceled.');
        } else {
          showErrorToast('Payment Failed', presentError.message);
        }
        return;
      }

      showSuccessToast('Card Payment Success', `NZD${finalFare.toFixed(2)} processed via Stripe.`);

      const paymentDetails = {
        method: 'Debit/Credit Card',
        amount: finalFare.toFixed(2),
        totalMobility: totalMobilityChecked,
        extraAmount: parseFloat(extraAmount || 0).toFixed(2),
        discountAmount: parseFloat(discountAmount || 0).toFixed(2),
        reason: reason,
        recordedAt: new Date().toISOString(),
      };
      await finalizeJobAndPayment(paymentDetails);

    } catch (err) {
      console.error('Stripe Payment Error:', err.message);
      showErrorToast('Payment Failed', err.message || 'An unexpected error occurred during card payment.');
    } finally {
      setIsStripeSheetLoading(false);
      setIsProcessingPayment(false);
    }
  }, [initPaymentSheet, presentPaymentSheet, currentJob, totalMobilityChecked, extraAmount, discountAmount, reason, driver, finalizeJobAndPayment]);



const handleTapToPay = useCallback(async () => {
  setIsProcessingPayment(true);
  
  try {
    // 1. Check NFC support and enable
    const isSupported = await NfcManager.isSupported();
    if (!isSupported) {
      throw new Error('NFC not supported on this device');
    }

    if (!(await NfcManager.isEnabled())) {
      showInfoToast('Enable NFC', 'Please enable NFC in device settings');
      await NfcManager.goToNfcSetting();
      throw new Error('NFC disabled');
    }

    // 2. Initialize NFC
    await NfcManager.start();
    showInfoToast('Ready to Tap', 'Hold customer\'s card near the NFC reader');

    // 3. Register for NFC discovery with timeout
    // This line was moved inside the try block
    const tag = await Promise.race([
      NfcManager.requestTechnology(NfcTech.IsoDep),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('NFC timeout')), 30000)
      )
    ]);

    // 4. Get card UID (important for transaction tracking)
    const cardUid = tag.id ? 
      Array.from(tag.id).map(b => b.toString(16).padStart(2, '0')).join(':') : 
      'unknown';

    // 5. Create payment intent
    const paymentIntent = await api.post(
      JOBENDPOINT.CREATE_NFC_PAYMENT_INTENT, 
      {
        amount: Math.round(calculatedTotalFareRef.current * 100),
        currency: 'nzd',
        rideId: currentJob?.id,
        cardUid,
        deviceInfo: {
          model: 'Samsung Galaxy S23',
          manufacturer: 'Samsung',
        }
      }, 
      {
          Authorization: `Bearer ${driver.token}`,
          
        }
    );

     if (!paymentIntent || !paymentIntent || !paymentIntent.data?.paymentIntentId || !paymentIntent.data?.clientSecret) {
      //  
        showErrorToast(
      'Tap Failed', 'Payment failed'
        );
      throw new Error('Invalid response structure from backend payment intent endpoint.');
      }

    // 6. Process with Stripe Terminal (simulated)
    // In production, you would integrate with Stripe Terminal SDK here
    await processNfcPayment(paymentIntent.data.clientSecret);

    // 7. Record successful payment
    const paymentDetails = {
      method: 'NFC Tap-to-Pay',
      amount: calculatedTotalFareRef.current.toFixed(2),
      transactionId: paymentIntent.data?.paymentIntentId,
      cardLast4: paymentIntent.data?.cardLast4 || '••••',
      totalMobility: totalMobilityChecked,
      extraAmount: parseFloat(extraAmount || 0).toFixed(2),
      discountAmount: parseFloat(discountAmount || 0).toFixed(2),
      reason,
      recordedAt: new Date().toISOString(),
    };

    await finalizeJobAndPayment(paymentDetails);
    showSuccessToast('Payment Successful', `NZD${calculatedTotalFareRef.current.toFixed(2)} processed`);

  } catch (error) {
    console.error('NFC Payment Error:', error);
    showErrorToast(
      'Tap Failed', 
      error.message.includes('timeout') ? 'Tap timed out' : 
      error.message || 'Payment failed'
    );
    trackPaymentEvent('nfc_failure', { 
      error: error.message,
      amount: calculatedTotalFareRef.current 
    });
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
      NfcManager.unregisterTagEvent();
    } catch (cleanupError) {
      console.warn('NFC cleanup error:', cleanupError);
    }
    setIsProcessingPayment(false);
  }
}, [currentJob, driver, totalMobilityChecked, extraAmount, discountAmount, reason, finalizeJobAndPayment]);


// Simulated payment processing
const processNfcPayment = async (clientSecret) => {
  return new Promise((resolve) => {
    // In production, replace with Stripe Terminal SDK calls
    setTimeout(resolve, 2000); 
  });
};
// --- Handle Scan Card ---


const handleScanCard = useCallback(async () => {
 // NEW: Get scanCard from the useStripe hook
  

  // Ensure scanCard is available before proceeding
  if (!scanCard) {
    console.error("Stripe's scanCard function is not available. Ensure you are using a compatible version and the component is wrapped in <StripeProvider>.");
    showErrorToast('Scan Failed', 'Card scanning feature is not available.');
    setIsStripeSheetLoading(false);
    return; // Exit the function early
  }
  console.log('handleScanCard called');
  setIsStripeSheetLoading(true);
  
   try {
    // 1. Check camera permissions
    // Request camera permissions from the user. This is crucial for using the device's camera to scan cards.
    const cameraPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA
    );
    
    // If camera permission is not granted, throw an error to stop the process.
    if (cameraPermission !== 'granted') {
      throw new Error('Camera permission required for card scanning');
    }

    // 2. Initialize Stripe CardScan
    // Initialize the Stripe SDK with your publishable key and Stripe account ID.
    // Replace 'pk_test_snO3BkhQgYmzMBKFTN1i82Ch' with your actual publishable key.
    // Replace 'acct_1A5EX1LVIu0y48p0' with your actual Stripe Connected Account ID if applicable.
    // NOTE: initStripe should ideally be called once at the app's root or a higher level,
    // not repeatedly in a function like this. If it's already done elsewhere, you can remove this.
    await initStripe({
      publishableKey: 'pk_test_snO3BkhQgYmzMBKFTN1i82Ch',
      stripeAccountId: 'acct_1A5EX1LVIu0y48p0',
    });

    // 3. Launch card scanner
    // Initiate the card scanning process using the scanCard function obtained from useStripe.
    // `requireName: true` means the scanner will also try to extract the cardholder's name.
    // `style` allows for custom branding of the scanner UI.
    const scanResult = await scanCard({
      requireName: true,
      style: {
        backgroundColor: COLOR_BACKGROUND, // Background color for the scanner UI
        accentColor: COLOR_ACCENT_PRIMARY, // Accent color for highlights in the scanner UI
      },
    });

    // Check if there was an error during the card scan.
    if (scanResult.error) {
      throw new Error(scanResult.error.message);
    }

    // Ensure a payment method ID was successfully returned from the scan.
    if (!scanResult.paymentMethodId) {
      throw new Error('No payment method ID returned from scan');
    }

    // 4. Create payment intent with scanned card
    // Make an API call to your backend to create a Stripe Payment Intent.
    // This API endpoint (JOBENDPOINT.GET_STRIPE_SCAN_CREATE_PAYMENT_INTENT)
    // should take the paymentMethodId and create a Payment Intent on Stripe's side,
    // returning the clientSecret, customerId, and ephemeralKey.
    const paymentIntent = await api.post(
      JOBENDPOINT.GET_STRIPE_SCAN_CREATE_PAYMENT_INTENT, 
      {
        amount: calculatedTotalFareRef.current, // The amount to charge (usually in smallest currency unit, e.g., cents)
        currency: 'nzd', // The currency, e.g., 'nzd' for New Zealand Dollars
        rideId: currentJob?.id, // An identifier for the ride or transaction
        paymentMethodId: scanResult.paymentMethodId // The ID of the payment method obtained from the card scan
      }, 
      {
        headers: {
          Authorization: `Bearer ${driver.token}` // Authorization token for your API
        }
      }
    );

    // 5. Process with Stripe Payment Sheet
    // Initialize the Stripe Payment Sheet with details from the created Payment Intent.
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Taxi Time NZ', // Name displayed on the payment sheet
      customerId: paymentIntent.data.customerId, // Customer ID from your backend
      customerEphemeralKeySecret: paymentIntent.data.ephemeralKey, // Ephemeral key for the customer
      paymentIntentClientSecret: paymentIntent.data.clientSecret, // Client secret for the Payment Intent
      allowsDelayedPaymentMethods: false, // Set to true if you allow methods like SEPA Direct Debit
      appearance: { // Customize the appearance of the payment sheet
        colors: {
          primary: COLOR_ACCENT_PRIMARY,
          background: COLOR_BACKGROUND,
          componentBackground: COLOR_SURFACE,
        }
      }
    });

    // If there's an error during payment sheet initialization, throw it.
    if (initError) throw initError;

    // Present the initialized payment sheet to the user.
    const { error: presentError } = await presentPaymentSheet();
    // If there's an error during payment sheet presentation (e.g., user cancels), throw it.
    if (presentError) throw presentError;

    // 6. Record successful payment
    // If the payment process completes without errors, record the payment details.
    const paymentDetails = {
      method: `Card (Scanned)`, // Payment method description
      amount: calculatedTotalFareRef.current.toFixed(2), // Formatted amount
      transactionId: paymentIntent.data.paymentIntentId, // Stripe Payment Intent ID
      totalMobility: totalMobilityChecked, // Boolean indicating mobility inclusion
      extraAmount: parseFloat(extraAmount || 0).toFixed(2), // Any extra charges
      discountAmount: parseFloat(discountAmount || 0).toFixed(2), // Any discounts
      reason: reason, // Reason for the transaction
      recordedAt: new Date().toISOString(), // Timestamp of the payment
    };

    // Call a function to finalize the job and persist payment details to your system.
    await finalizeJobAndPayment(paymentDetails);

  } catch (error) {
    // Catch any errors that occur during the entire process.
    console.error('Card Scan Error:', error);
    // Display an error message to the user.
    showErrorToast(
      'Scan Failed', 
      error.message || 'Could not process scanned card' // Generic message if specific error message is not available
    );
  } finally {
    // This block always executes, regardless of success or failure.
    // Reset the loading state.
    setIsStripeSheetLoading(false);
  }
}, [scanCard , initPaymentSheet, presentPaymentSheet, currentJob, driver, totalMobilityChecked, extraAmount, discountAmount, reason, finalizeJobAndPayment, useStripe]); // <-- NEW: Added useStripe to dependencies
 // --- Main Payment Handler (for non-Stripe Sheet methods) ---
  const handleRecordPayment = useCallback(async () => {
    Keyboard.dismiss();
    setIsProcessingPayment(true);

    const finalFare = calculatedTotalFareRef.current;

    // --- Input Validation ---
    if (finalFare < 0) {
      showErrorToast('Validation Error', 'Final fare cannot be negative.');
      setIsProcessingPayment(false);
      return;
    }
    if (selectedPaymentMethod === 'Cash' && finalFare === 0) {
      showErrorToast('Validation Error', 'Cash payment requires a positive amount.');
      setIsProcessingPayment(false);
      return;
    }
    if ((selectedPaymentMethod === 'Account' || selectedPaymentMethod === 'ACC') && !accountNumber.trim()) {
      showErrorToast('Validation Error', `Please enter the ${selectedPaymentMethod} number.`);
      setIsProcessingPayment(false);
      return;
    }
    if (selectedPaymentMethod === 'Gift Card' && !giftCardNumber.trim()) {
      showErrorToast('Validation Error', 'Please enter the Gift Card number.');
      setIsProcessingPayment(false);
      return;
    }

    if (selectedPaymentMethod === 'Debit/Credit Card') {
      showInfoToast('Choose Card Option', 'Please select a specific card option (Process with Stripe, Scan, or Tap to Pay) above.');
      setIsProcessingPayment(false);
      return;
    }

    const paymentDetails = {
      method: selectedPaymentMethod,
      amount: finalFare.toFixed(2),
      totalMobility: totalMobilityChecked,
      extraAmount: parseFloat(extraAmount || 0).toFixed(2),
      discountAmount: parseFloat(discountAmount || 0).toFixed(2),
      reason: reason,
      recordedAt: new Date().toISOString(),
      ...(selectedPaymentMethod === 'Account' || selectedPaymentMethod === 'ACC' ? { accountNumber: accountNumber.trim() } : {}),
      ...(selectedPaymentMethod === 'Gift Card' ? { giftCardNumber: giftCardNumber.trim() } : {}),
    };
    await finalizeJobAndPayment(paymentDetails);
  }, [selectedPaymentMethod, extraAmount, discountAmount, reason, accountNumber, giftCardNumber, totalMobilityChecked, calculatedTotalFareRef, finalizeJobAndPayment]);


  const handleReturnToJob = useCallback(async () => {
    Keyboard.dismiss();
    setIsReturningToJob(true);
    LayoutAnimation.easeInEaseOut();

    try {
      await changeRideStatus('started', currentJob?.id, driver.driverId, driver.token, currentJob);
      setJobStatus('started');
      updateCurrentJob({ resume_job_time: new Date().toISOString(), status: 'started' } , 'resumedJob');

      showSuccessToast('Job Resumed', 'Redirecting back to the job tracking screen.');
      // navigation.replace('JobTrackingScreen', { job: currentJob });
    } catch (err) {
      console.error('Error resuming job:', err.message);
      showErrorToast('Error', 'Failed to resume job. Please try again.');
    } finally {
      setIsReturningToJob(false);
    }
  }, [currentJob, driver, navigation, setJobStatus, updateCurrentJob]);


  if (!currentJob?.id || !currentJob?.pricingBreakdown) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLOR_ACCENT_PRIMARY} />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  const distance = currentJob.pricingBreakdown.totalDistance || 0;
  const waitingCost = currentJob.pricingBreakdown.waitingCost || 0;
  const baseRideCost = currentJob.pricingBreakdown.totalCost || currentJob.earningsSoFar || 0;

  const rideDurationSeconds =
    currentJob.driver_job_start_time && currentJob.complete_job_time
      ? Math.floor((new Date(currentJob.complete_job_time).getTime() - new Date(currentJob.driver_job_start_time).getTime()) / 1000)
      : 0;

  return (
    

   
    <SafeAreaView style={styles.safeArea}>
    
      <StatusBar barStyle="light-content" backgroundColor={COLOR_BACKGROUND} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color={COLOR_TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Ride</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
   
      <Animated.ScrollView
        contentContainerStyle={styles.scrollViewContent}
        style={{ opacity: fadeAnim }}
        keyboardShouldPersistTaps="handled"
      >
       
        <View style={styles.card}>
          {/* --- Ride Summary Grid --- */}
          <SectionHeader title="Ride Summary" icon="map-marker-distance" />
          <View style={styles.rideSummaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Distance</Text>
              <Text style={styles.summaryValue}>{formatDistanceKm(distance)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{formatDurationSeconds(rideDurationSeconds)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Base Fare</Text>
              <Text style={styles.summaryValue}>{formatCurrencyNZD(baseRideCost)} NZD</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Waiting Cost</Text>
              <Text style={styles.summaryValue}>{formatCurrencyNZD(waitingCost)} NZD</Text>
            </View>
          </View>

          {/* --- Total Fare Display --- */}
          <View style={styles.totalDueContainer}>
            <Text style={styles.totalDueLabel}>TOTAL DUE</Text>
            <View style={styles.totalDueValueWrapper}>
              <Text style={styles.currencySymbolLarge}>NZD</Text>
              <Text style={styles.totalDueValue}>{formatCurrencyNZD(calculatedTotalFareRef.current)}</Text>
            </View>
          </View>

          {/* --- Return to Job Button --- */}
          <TouchableOpacity
            style={[styles.returnButton, isReturningToJob && styles.buttonLoading]}
            onPress={!isReturningToJob ? handleReturnToJob : null}
            activeOpacity={isReturningToJob ? 1 : 0.7}
          >
            {isReturningToJob ? (
              <ActivityIndicator size="small" color={COLOR_TEXT_PRIMARY} />
            ) : (
              <>
                <Icon name="arrow-left-circle-outline" size={18} color={COLOR_TEXT_PRIMARY} />
                <Text style={styles.returnButtonText}>Return to Job</Text>
              </>
            )}
          </TouchableOpacity>

          {/* --- Payment Details Section --- */}
          <SectionHeader title="Payment Options" icon="credit-card-multiple-outline" />

          {/* Total Mobility Option */}
          <View style={styles.totalMobilityContainer}>
            <Text style={styles.totalMobilityText}>Total Mobility Discount</Text>
            <Switch
              trackColor={{ false: '#767577', true: COLOR_ACCENT_SECONDARY }}
              thumbColor={totalMobilityChecked ? COLOR_TEXT_PRIMARY : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={setTotalMobilityChecked}
              value={totalMobilityChecked}
            />
          </View>

          {/* Payment Method Tabs */}
          <View style={styles.paymentTabsContainer}>
            {['Cash', 'Debit/Credit Card', 'EFTPOS', 'Account', 'ACC', 'Gift Card'].map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentTab,
                  selectedPaymentMethod === method && styles.paymentTabActive,
                ]}
                onPress={() => setSelectedPaymentMethod(method)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.paymentTabText,
                  selectedPaymentMethod === method && styles.paymentTabTextActive,
                ]}>
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* --- Card Payment Options (Conditional) --- */}
          {selectedPaymentMethod === 'Debit/Credit Card' && (
            <View style={styles.cardPaymentOptionsContainer}>
              <Text style={styles.inputLabel}>Choose Card Input Method:</Text>
              <View style={styles.cardPaymentButtonsRow}>
                <TouchableOpacity
                  style={[styles.cardOptionButton, isStripeSheetLoading && styles.buttonLoading]}
                  onPress={!isStripeSheetLoading ? () => handleProcessWithStripeSheet(calculatedTotalFareRef.current) : null}
                  activeOpacity={isStripeSheetLoading ? 1 : 0.7}
                >
                  {isStripeSheetLoading ? (
                    <ActivityIndicator size="small" color={COLOR_TEXT_PRIMARY} />
                  ) : (
                    <>
                      <Icon name="qrcode-scan" size={18} color={COLOR_TEXT_PRIMARY} />
                      <Text style={styles.cardOptionButtonText}>Scan Card</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* <TouchableOpacity
                  style={styles.cardOptionButton}
                  onPress={handleScanCard} // Calls new scan handler
                  activeOpacity={0.7}
                >
                  <Icon name="qrcode-scan" size={18} color={COLOR_TEXT_PRIMARY} />
                  <Text style={styles.cardOptionButtonText}>Scan Card</Text>
                </TouchableOpacity> */}

                <TouchableOpacity
                  style={styles.cardOptionButton}
                  onPress={handleTapToPay} // Calls new tap to pay handler
                  activeOpacity={0.7}
                >
                  <Icon name="nfc-variant" size={18} color={COLOR_TEXT_PRIMARY} />
                  <Text style={styles.cardOptionButtonText}>Tap to Pay (NFC)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Conditionally rendered inputs based on payment method */}
          {(selectedPaymentMethod === 'Account' || selectedPaymentMethod === 'ACC') && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{selectedPaymentMethod} Number</Text>
              <TextInput
                style={[
                  styles.textInput,
                  accountInputFocused && styles.textInputFocused
                ]}
                placeholder={`Enter ${selectedPaymentMethod} Number`}
                placeholderTextColor={COLOR_TEXT_SECONDARY}
                keyboardType="default"
                value={accountNumber}
                onChangeText={setAccountNumber}
                onFocus={() => setAccountInputFocused(true)}
                onBlur={() => setAccountInputFocused(false)}
              />
            </View>
          )}

          {selectedPaymentMethod === 'Gift Card' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gift Card Number</Text>
              <TextInput
                style={[
                  styles.textInput,
                  giftCardInputFocused && styles.textInputFocused
                ]}
                placeholder="Enter Gift Card Number"
                placeholderTextColor={COLOR_TEXT_SECONDARY}
                keyboardType="numeric"
                value={giftCardNumber}
                onChangeText={setGiftCardNumber}
                onFocus={() => setGiftCardInputFocused(true)}
                onBlur={() => setGiftCardInputFocused(false)}
              />
            </View>
          )}

          {/* Adjustments: Extra, Discount, Reason */}
          <SectionHeader title="Adjustments" icon="cash-plus" />

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Extra Amount (NZD)</Text>
            <TextInput
              style={[
                styles.textInput,
                extraInputFocused && styles.textInputFocused
              ]}
              placeholder="0.00"
              placeholderTextColor={COLOR_TEXT_SECONDARY}
              keyboardType="numeric"
              value={extraAmount}
              onChangeText={setExtraAmount}
              onFocus={() => setExtraInputFocused(true)}
              onBlur={() => setExtraInputFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Discount Amount (NZD)</Text>
            <TextInput
              style={[
                styles.textInput,
                discountInputFocused && styles.textInputFocused
              ]}
              placeholder="0.00"
              placeholderTextColor={COLOR_TEXT_SECONDARY}
              keyboardType="numeric"
              value={discountAmount}
              onChangeText={setDiscountAmount}
              onFocus={() => setDiscountInputFocused(true)}
              onBlur={() => setDiscountInputFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reason for Adjustment</Text>
            <TextInput
              style={[
                styles.textInput,
                reasonInputFocused && styles.textInputFocused
              ]}
              placeholder="e.g., Airport Charges, Loyalty Discount"
              placeholderTextColor={COLOR_TEXT_SECONDARY}
              value={reason}
              onChangeText={setReason}
              onFocus={() => setReasonInputFocused(true)}
              onBlur={() => setReasonInputFocused(false)}
              multiline={true}
              numberOfLines={2}
            />
          </View>

          {/* Record Payment Button (only for non-card methods, as card has its own buttons) */}
          {selectedPaymentMethod !== 'Debit/Credit Card' && (
            <TouchableOpacity
              style={[styles.recordPaymentButton, isProcessingPayment && styles.buttonLoading]}
              onPress={!isProcessingPayment ? handleRecordPayment : null}
              activeOpacity={isProcessingPayment ? 1 : 0.7}
            >
              {isProcessingPayment ? (
                <ActivityIndicator size="small" color={COLOR_TEXT_PRIMARY} />
              ) : (
                <Text style={styles.recordPaymentButtonText}>Record Payment</Text>
              )}
            </TouchableOpacity>
          )}
          </View>
         
       
        </Animated.ScrollView>
       
      </SafeAreaView>
 
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLOR_BACKGROUND,
  },
  loadingText: {
    color: COLOR_TEXT_PRIMARY,
    marginTop: SPACING,
    fontSize: 16,
    fontWeight: '500',
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING * 0.6,
    paddingHorizontal: SPACING * 1.5,
    backgroundColor: COLOR_SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#282828',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLOR_TEXT_PRIMARY,
  },
  backButton: {
    padding: SPACING * 0.2,
  },
  headerRightPlaceholder: {
    width: 20,
  },
  scrollViewContent: {
    flexGrow: 1,
    backgroundColor: COLOR_BACKGROUND,
    alignItems: 'center',
    paddingVertical: SPACING,
    paddingHorizontal: SPACING * 1.5,
  },
  card: {
    backgroundColor: COLOR_SURFACE,
    borderRadius: 12,
    paddingVertical: CARD_PADDING_VERTICAL,
    paddingHorizontal: CARD_PADDING_HORIZONTAL,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLOR_ACCENT_PRIMARY,
    alignItems: 'center',
    marginBottom: SPACING * 0.8,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: SPACING * 0.8,
    paddingBottom: SPACING * 0.2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_ACCENT_SECONDARY,
    width: '100%',
    marginTop: SPACING,
  },
  sectionHeaderIcon: {
    marginRight: SPACING * 0.4,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLOR_TEXT_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rideSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: SPACING * 0.6,
  },
  summaryItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    paddingVertical: SPACING * 0.3,
    marginBottom: SPACING * 0.3,
    backgroundColor: '#1E1E1E',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A3A3A',
    minHeight: 55,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLOR_TEXT_SECONDARY,
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    color: COLOR_ACCENT_SECONDARY,
    fontWeight: 'bold',
  },
  totalDueContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING * 0.7,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLOR_WARNING,
    width: '100%',
    marginTop: SPACING,
    marginBottom: SPACING * 1.2,
  },
  totalDueLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLOR_WARNING,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  totalDueValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbolLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLOR_WARNING,
    marginRight: 4,
  },
  totalDueValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLOR_WARNING,
  },
  returnButton: {
    backgroundColor: COLOR_BUTTON_RETURN,
    paddingVertical: 10,
    borderRadius: 8,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLOR_BUTTON_RETURN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    marginBottom: SPACING * 1.5,
    gap: 6,
  },
  returnButtonText: {
    color: COLOR_TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  totalMobilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING * 0.8,
    width: '100%',
    paddingHorizontal: SPACING * 0.2,
  },
  totalMobilityText: {
    color: COLOR_TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
  },
  paymentTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    marginBottom: SPACING * 1.2,
    backgroundColor: '#282828',
    borderRadius: 8,
    padding: 2,
  },
  paymentTab: {
    flexGrow: 1,
    flexBasis: '31%',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    margin: 1.5,
  },
  paymentTabActive: {
    backgroundColor: COLOR_ACCENT_PRIMARY,
    shadowColor: COLOR_ACCENT_PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  paymentTabText: {
    color: COLOR_TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  paymentTabTextActive: {
    color: '#FFF',
  },
  cardPaymentOptionsContainer: {
    width: '100%',
    backgroundColor: '#282828',
    borderRadius: 8,
    padding: SPACING,
    marginBottom: SPACING * 1.2,
  },
  cardPaymentButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SPACING * 0.8,
  },
  cardOptionButton: {
    backgroundColor: COLOR_INPUT_BACKGROUND,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLOR_INPUT_BORDER,
    paddingVertical: SPACING * 0.6,
    paddingHorizontal: SPACING * 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexBasis: '48%',
    marginBottom: SPACING * 0.4,
    gap: SPACING * 0.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  cardOptionButtonText: {
    color: COLOR_TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: SPACING,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR_TEXT_SECONDARY,
    marginBottom: SPACING * 0.2,
    alignSelf: 'flex-start',
  },
  textInput: {
    backgroundColor: COLOR_INPUT_BACKGROUND,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLOR_INPUT_BORDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: COLOR_TEXT_PRIMARY,
    fontSize: 14,
    width: '100%',
    minHeight: Platform.OS === 'ios' ? 36 : 40,
  },
  textInputFocused: {
    borderColor: COLOR_ACCENT_PRIMARY,
    shadowColor: COLOR_ACCENT_PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  recordPaymentButton: {
    backgroundColor: COLOR_ACCENT_PRIMARY,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: COLOR_ACCENT_PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
    marginTop: SPACING,
  },
  recordPaymentButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  buttonLoading: {
    backgroundColor: '#6A6A6A',
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING * 0.4,
    width: '100%',
  },
  itemIcon: {
    marginRight: SPACING * 0.4,
  },
  labelValueContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLOR_TEXT_SECONDARY,
  },
  value: {
    fontSize: 14,
    color: COLOR_TEXT_PRIMARY,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
});

export default CompleteJobScreen;