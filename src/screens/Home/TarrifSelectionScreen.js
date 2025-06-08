// screens/Home/TarrifSelectionScreen.js
import React, { useState, useCallback, useContext, useEffect } from 'react';
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
import { ShiftContext } from '../../context/ShiftContext'; // To access startShift
import { getCurrentLocationforce, startService } from '../../BackgroundService'; // getCurrentLocationforce for fetching location
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showErrorToast, showSuccessToast } from '../../utils/showToast';
import { shiftStatusChange } from '../../utils/common';
import useLocationStore from '../../store/locationStore'; // To get current location from store

const { width } = Dimensions.get('window');
const SPACING = width * 0.05;
const ITEM_MARGIN_BOTTOM = 10;

const TarrifSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // selectedVehicle is still passed via route params from StartShiftScreen
  const { selectedVehicle } = route.params || {};

  // Consume relevant states and functions from TarrifContext
  const {
    isNeedtoRefresh,
    fetchZoneAndTariffs,
    selectTarrif,
    selectedTarrif,
    availableTariffs,
    updateisNeedtoRefresh,
    detectedZone, // Get detectedZone from context
  } = useContext(TarrifContext);

  const { startShift, driver } = useContext(ShiftContext);
  const { latitude, longitude } = useLocationStore(); // Get live location from store

  // Local state for location if not immediately available from store (though store is preferred)
  const [currentLatitude, setCurrentLatitude] = useState(latitude);
  const [currentLongitude, setCurrentLongitude] = useState(longitude);

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingTariffs, setIsLoadingTariffs] = useState(false);
  const [refreshTariffs, setRefreshTariffs] = useState(false); // State to trigger re-fetching of tariffs if needed
  // State to track the currently selected tariff locally for UI feedback
  const [currentSelectedTariffId, setCurrentSelectedTariffId] = useState(selectedTarrif?.id || null);

  // Effect to fetch initial location if not already in store
  useEffect(() => {
    const fetchInitialLocation = async () => {
      // If location is not available from store, try to get it forcefully
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
    fetchInitialLocation();
  }, [latitude, longitude , refreshTariffs]); // Re-run if store location changes (unlikely to be null after initial load)

  // Effect to fetch tariffs once location and driver token are available
  useEffect(() => {
    const loadTariffs = async () => {
      console.log('Loading tariffs with current location:', currentLatitude, currentLongitude);
      // Only fetch if location is available, driver token is available, AND tariffs/zone haven't been loaded yet by context
      if (currentLatitude !== null && currentLongitude !== null && driver?.token && !availableTariffs.length && !detectedZone) {
        setIsLoadingTariffs(true);
        try {
          // This call will update `detectedZone` and `availableTariffs` in TarrifContext
          await fetchZoneAndTariffs(currentLatitude, currentLongitude, driver.token);
        } catch (error) {
          console.error('Error fetching zone and tariffs in TariffSelectionScreen:', error);
          showErrorToast('API Error', 'Failed to fetch tariffs for your location. Please try again.');
        } finally {
          setIsLoadingTariffs(false);
        }
      }
    };
    loadTariffs();
  }, [refreshTariffs]);

  // Effect to ensure the local selection reflects the context's selected tariff on mount/context change
  useEffect(() => {
    if (selectedTarrif && selectedTarrif.id !== currentSelectedTariffId) {
      setCurrentSelectedTariffId(selectedTarrif.id);
    }
  }, [selectedTarrif, currentSelectedTariffId]);

  const handleSelectTariff = useCallback((tariff) => {


    setCurrentSelectedTariffId(tariff.id);
    selectTarrif(tariff); // Store the selected tariff in TarrifContext
  }, [selectTarrif]);

  const handleGoOnline = useCallback(async () => {
    const userId = auth().currentUser?.uid;

    // if (!selectedVehicle) {
    //   showErrorToast('Error', 'No vehicle selected. Please go back to the previous screen.');
    //   navigation.goBack(); // Navigate back to StartShiftScreen
    //   return;
    // }
    setIsLoadingTariffs(true);
    updateisNeedtoRefresh(true)


    if (!selectedTarrif || !currentSelectedTariffId) {
      showErrorToast('Selection Required', 'Please select a tariff to go online.');
      return;
    }

    // `detectedZone` is now from context
    if (detectedZone    && selectedTarrif && userId) {
      try {
        let CompanyId = await AsyncStorage.getItem('CompanyId') || '1';

         updateisNeedtoRefresh(false)
   
        showSuccessToast('Shift Started', `You are now online with  ${selectedTarrif.name} tariff!`);
        // navigation.replace('Home'); // Navigate to Home after successfully going online
      } catch (error) {
        console.error('Error going online with vehicle and tariff:', error);
        showErrorToast('Error', 'Failed to go online. Please try again.');
      }
    } else {
      showErrorToast('Error', 'Missing vehicle, tariff, or zone information to go online.');
    }
  }, [selectedVehicle, selectedTarrif, currentSelectedTariffId, detectedZone, startShift, driver, navigation]);

  const renderTariffItem = useCallback(({ item }) => {
    const isSelected = currentSelectedTariffId === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.tariffItem,
          isSelected && styles.selectedTariff,
        ]}
        onPress={() => {
           handleSelectTariff(item)
        }}
        activeOpacity={0.7}
      >
        <Icon name="cash-multiple" size={24} color={isSelected ? '#FFD700' : '#ADD8E6'} style={styles.tariffIcon} />
        <View style={styles.tariffDetails}>
          <Text style={[styles.tariffName, isSelected && styles.selectedTariffText]}>{item.name}</Text>
          <Text style={styles.tariffDescription}>
            Starting Price: ${item.startingPrice} for {item.startingDistance}m
          </Text>
          <Text style={styles.tariffDescription}>
            Distance Rate: ${item.distanceRate}/m | Time Rate: ${item.timeRate}/s
          </Text>
          <Text style={styles.tariffDescription}>
            Waiting Rate: ${item.waitingRate}/s
          </Text>
        </View>
        {isSelected && <Icon name="check-circle" size={24} color="#4CAF50" style={styles.checkIcon} />}
      </TouchableOpacity>
    );
  }, [currentSelectedTariffId, handleSelectTariff]);

  // Conditional rendering for loading states or no data
  if (isLoadingLocation || isLoadingTariffs) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>
          {isLoadingLocation ? 'Getting your location...' : 'Finding tariffs for your zone...'}
        </Text>
      </View>
    );
  }

  // Display message if no tariffs are available.
  // This implicitly covers cases where no zone was detected as `availableTariffs` would be empty.
  if (!availableTariffs || availableTariffs.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Tariff</Text>
        </View>
        <Text style={styles.noTariffsText}>
          {/* Display more specific message if a zone was detected but had no tariffs */}
          {detectedZone ? `No tariffs found for zone: ${detectedZone.zoneName}.` : 'No tariffs available for your current location (zone not detected or no tariffs assigned).'}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshButton} onPress={() => {
            setRefreshTariffs(!refreshTariffs); // Trigger re-fetching of tariffs
          }}>
            <Text style={styles.backButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Your Tariff</Text>
        {/* Only display zone name if detectedZone is available */}
        {detectedZone?.zoneName && <Text style={styles.zoneInfo}>Detected Zone: {detectedZone.zoneName}</Text>}
      </View>

      <FlatList
        data={availableTariffs} // Display tariffs from TarrifContext
        keyExtractor={(item) => item.id}
        renderItem={renderTariffItem}
        contentContainerStyle={styles.tariffList}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.goOnlineButton, !currentSelectedTariffId && styles.disabledButton]}
        onPress={handleGoOnline}
        disabled={!currentSelectedTariffId}
        activeOpacity={0.7}
      >
        <Icon name="power" size={20} color="#fff" style={styles.goOnlineButtonIcon} />
        <Text style={styles.goOnlineButtonText}>{ !currentSelectedTariffId ? 'Select to Go Online' : 'Choose Tariff' }</Text>
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
