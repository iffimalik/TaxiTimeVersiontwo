import React, { useState, useCallback, useContext, useEffect, useRef } from 'react'; // Import useRef
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { TarrifContext } from '../../context/TarrifContext';
import { ShiftContext } from '../../context/ShiftContext';
import { getCurrentLocationforce, startService } from '../../BackgroundService';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showErrorToast, showSuccessToast } from '../../utils/showToast';
import { shiftStatusChange } from '../../utils/common';
import useLocationStore from '../../store/locationStore';

const { width } = Dimensions.get('window');
const SPACING = width * 0.05;
const ITEM_MARGIN_BOTTOM = 10;
const MAX_RETRY_ATTEMPTS = 10; // Define your retry limit

const TarrifSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedVehicle } = route.params || {};

  const { isBackgroundServiceRunning } = useLocationStore();

  const {
    fetchZoneAndTariffs,
    updateSelectedTarrif,
    availableTariffs,
    detectedZone,
    selectedTarrif,
    setIsNeedtoRefresh,
    updateisNeedtoRefresh
  } = useContext(TarrifContext);

  const { driver ,  startShift} = useContext(ShiftContext);
  const { latitude, longitude } = useLocationStore();

  const [currentLatitude, setCurrentLatitude] = useState(latitude);
  const [currentLongitude, setCurrentLongitude] = useState(longitude);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingTariffs, setIsLoadingTariffs] = useState(false);
  const [refreshTariffsFlag, setRefreshTariffsFlag] = useState(false);
  const [isGoingOnline, setIsGoingOnline] = useState(false);

  // New state for retry mechanism
  const [tariffFetchRetryCount, setTariffFetchRetryCount] = useState(0);

  const [currentSelectedTariffId, setCurrentSelectedTariffId] = useState(selectedTarrif?.id || null);
  console.log("🚀 ~ TarrifSelectionScreen ~ selectedTarrif:", selectedTarrif);
  // Effect 1: Start background service if not running & Fetch initial location
  useEffect(() => {
    if (!isBackgroundServiceRunning) {
      startService();
    }

    const fetchAndSetInitialLocation = async () => {
      if (latitude === null || longitude === null) {
        setIsLoadingLocation(true);
        try {
          const location = await getCurrentLocationforce();
          setCurrentLatitude(location.coords.latitude);
          setCurrentLongitude(location.coords.longitude);
        } catch (error) {
          console.error('Error getting initial location:', error);
          showErrorToast('Location Error', 'Unable to fetch your current location. Please check your device settings.');
        } finally {
          setIsLoadingLocation(false);
        }
      }
    };
    fetchAndSetInitialLocation();
  }, [isBackgroundServiceRunning, latitude, longitude]);

  // Effect 2: Fetch tariffs when location or refresh flag changes, with retry limit
  useEffect(() => {
    const loadTariffs = async () => {
      if (currentLatitude !== null && currentLongitude !== null && driver?.token) {
        setIsLoadingTariffs(true);
        try {
          await fetchZoneAndTariffs(currentLatitude, currentLongitude, driver.token);
          // If fetch was successful, reset retry count
          setTariffFetchRetryCount(0);
        } catch (error) {
          console.error('Error fetching zone and tariffs:', error);
          showErrorToast('API Error', 'Failed to fetch tariffs for your location. Please try again.');
          // Increment retry count only on fetch failure
          setTariffFetchRetryCount(prev => prev + 1);
        } finally {
          setIsLoadingTariffs(false);
        }
      }
    };

    // Logic to control when `loadTariffs` runs
    // It runs if:
    // 1. Tariffs are currently empty (or null/undefined)
    // 2. AND we haven't exceeded the maximum retry attempts
    if ((!availableTariffs || availableTariffs.length === 0) && tariffFetchRetryCount < MAX_RETRY_ATTEMPTS) {
      loadTariffs();
    } else if (availableTariffs && availableTariffs.length === 0 && tariffFetchRetryCount >= MAX_RETRY_ATTEMPTS) {
        // If we've hit the retry limit and still no tariffs, log it and let UI handle it
        console.warn(`Reached max retry attempts (${MAX_RETRY_ATTEMPTS}) for tariffs. Manual refresh needed.`);
        // Optionally, show a specific persistent toast or message here
    }

  }, [currentLatitude, currentLongitude, driver?.token, fetchZoneAndTariffs, refreshTariffsFlag, availableTariffs, tariffFetchRetryCount]); // Dependencies for this effect

  // Effect 3: Sync local selected tariff ID with context's `selectedTarrif`
  useEffect(() => {
    setCurrentSelectedTariffId(selectedTarrif?.id || null);
  }, [selectedTarrif]);

  // Callbacks remain the same
  const handleSelectTariff = useCallback((tariff) => {
    updateSelectedTarrif(tariff);
    setCurrentSelectedTariffId(tariff?.id || null);
  }, [updateSelectedTarrif]);

  const renderTariffItem = useCallback(({ item }) => {
    const isSelected = currentSelectedTariffId === item.id;
    return (
      <TouchableOpacity
        style={[styles.tariffItem, isSelected && styles.selectedTariff]}
        onPress={() => handleSelectTariff(item)}
        activeOpacity={0.7}
      >
        <Icon name="cash-multiple" size={24} color={isSelected ? '#FFD700' : '#ADD8E6'} style={styles.tariffIcon} />
        <View style={styles.tariffDetails}>
          <Text style={[styles.tariffName, isSelected && styles.selectedTariffText]}>{item.name}</Text>
          <Text style={styles.tariffDescription}>
            Starting Price: ${item.startingPrice}
          </Text>
          <Text style={styles.tariffDescription}>
            Distance Rate: ${item.distanceRate * 1000}/Km | Time Rate: ${item.timeRate * 60}/min
          </Text>
          <Text style={styles.tariffDescription}>
            Waiting Rate: ${parseFloat(item.waitingRate * 60).toFixed(2)}/min
          </Text>
        </View>
        {isSelected && <Icon name="check-circle" size={24} color="#4CAF50" style={styles.checkIcon} />}
      </TouchableOpacity>
    );
  }, [currentSelectedTariffId, handleSelectTariff]);

  const handleGoOnline = useCallback(async () => {
    if (!selectedTarrif || !currentSelectedTariffId) {
      showErrorToast('Selection Required', 'Please select a tariff to go online.');
      return;
    }

    if (isGoingOnline) return;
    setIsGoingOnline(true);

    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        showErrorToast('Authentication Error', 'User not authenticated. Please log in again.');
        await auth().signOut();
        return;
      }

      // await startShift( selectedTarrif);
      updateisNeedtoRefresh(true)
      showSuccessToast('Shift Started', `You are now online with ${selectedTarrif.name} tariff!`);
      // navigation.replace('Home');
    } catch (error) {
      console.error('Error going online:', error.message);
      showErrorToast('Error', `Failed to go online: ${error.message || 'Please try again.'}`);
    } finally {
      setIsGoingOnline(false);
    }
  }, [selectedTarrif, currentSelectedTariffId, isGoingOnline, startShift, navigation]);


  // --- Conditional Rendering for UI States ---

  // Loading indicator
  if (isLoadingLocation || isLoadingTariffs || isGoingOnline) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>
          {isGoingOnline ? 'Going online...' : isLoadingLocation ? 'Getting your location...' : 'Finding tariffs for your zone...'}
        </Text>
      </View>
    );
  }

  // Display message if no tariffs are available AND we've exhausted retries
  if ((!availableTariffs || availableTariffs.length === 0) && tariffFetchRetryCount >= MAX_RETRY_ATTEMPTS) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Tariff</Text>
        </View>
        <Text style={styles.noTariffsText}>
          No tariffs found. Please try refreshing manually.
          {detectedZone ? ` Detected Zone: ${detectedZone.zoneName}.` : ''}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setTariffFetchRetryCount(0); // Reset retry count for manual refresh
            setRefreshTariffsFlag(prev => !prev); // Trigger re-fetching
          }}
        >
          <Text style={styles.backButtonText}>Refresh Tariffs Manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Display message if no tariffs are available but we are still trying to fetch
  if (!availableTariffs || availableTariffs.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Tariff</Text>
        </View>
        <Text style={styles.noTariffsText}>
          Searching for tariffs for your location... (Attempt {tariffFetchRetryCount + 1} of {MAX_RETRY_ATTEMPTS})
          {detectedZone ? ` Detected Zone: ${detectedZone.zoneName}.` : ''}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
        {/* No auto-refresh button here, it's handled by the effect */}
      </View>
    );
  }

  // Main content when tariffs are loaded
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Your Tariff</Text>
        {detectedZone?.zoneName && <Text style={styles.zoneInfo}>Detected Zone: {detectedZone.zoneName}</Text>}
      </View>

      <FlatList
        data={availableTariffs}
        keyExtractor={(item) => item.id}
        renderItem={renderTariffItem}
        contentContainerStyle={styles.tariffList}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.goOnlineButton, !currentSelectedTariffId && styles.disabledButton]}
        onPress={handleGoOnline}
        disabled={!currentSelectedTariffId || isGoingOnline}
        activeOpacity={0.7}
      >
        <Icon name="power" size={20} color="#fff" style={styles.goOnlineButtonIcon} />
        <Text style={styles.goOnlineButtonText}>
          {isGoingOnline ? 'Processing...' : !currentSelectedTariffId ? 'Select to Go Online' : 'Choose Tariff'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: StatusBar.currentHeight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#FFD700',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING,
    paddingVertical: 15,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  zoneInfo: {
    fontSize: 14,
    color: '#ccc',
  },
  tariffList: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 2,
  },
  tariffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 15,
    borderRadius: 10,
    marginBottom: ITEM_MARGIN_BOTTOM,
    borderWidth: 1,
    borderColor: '#333',
  },
  tariffIcon: {
    marginRight: 15,
  },
  tariffDetails: {
    flex: 1,
  },
  tariffName: {
    fontSize: 16,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    color: '#fff',
  },
  tariffDescription: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 3,
  },
  selectedTariff: {
    borderColor: '#FFD700',
    backgroundColor: '#303030',
  },
  selectedTariffText: {
    color: '#FFD700',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  goOnlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 30,
    marginHorizontal: SPACING,
    marginTop: 20,
    marginBottom: SPACING,
  },
  goOnlineButtonIcon: {
    marginRight: 10,
    color: '#fff',
  },
  goOnlineButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#607D8B',
    opacity: 0.7,
  },
  noTariffsText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 50,
    paddingHorizontal: SPACING,
  },
  backButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 30,
  },
  refreshButton: {
    backgroundColor: 'green',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 30,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TarrifSelectionScreen;