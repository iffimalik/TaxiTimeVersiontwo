import React, { useContext, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { ShiftContext } from '../../context/ShiftContext';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { startService, stopService } from '../../BackgroundService';
import database from '@react-native-firebase/database';
import { showErrorToast, showSuccessToast } from '../../utils/showToast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENDPOINTS } from '../../utils/constants';
import api from '../../services/api';
import { shiftStatusChange } from '../../utils/common';
const { width } = Dimensions.get('window');
const SPACING = width * 0.05;
const ITEM_MARGIN_BOTTOM = 10;

// const dummyVehicles = [
//   { id: 'v1', name: 'Toyota Camry', type: 'Sedan', plate: 'QAT-12345', icon: 'car-sedan' },
//   { id: 'v2', name: 'Hyundai Santa Fe', type: 'SUV', plate: 'QAT-67890', icon: 'suv' },
//   { id: 'v3', name: 'Nissan Patrol', type: 'SUV', plate: 'QAT-11223', icon: 'suv' },
// ];


 

const StartShiftScreen = () => {
  const navigation = useNavigation();
  const { startShift , driver , vehicles , logginDriverId  } = useContext(ShiftContext);
  const [selectedId, setSelectedId] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [dummyVehicles, setDummyVehicles] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
 

  useEffect(() => {
    const fetchVehicles = async () => {   
       // console.log('🟡 Fetching vehicles from backend API...' , JSON.stringify(vehicles));
    if (driver) { 
              setSelectedDriver(logginDriverId);
          }
    if (vehicles) { 
    
      setDummyVehicles(vehicles);
    
    } else {
      setDummyVehicles([]);
    }
  }; 
  fetchVehicles();
}, [driver, vehicles , logginDriverId]);



const handleStartShift = useCallback(async () => {
    const selectedVehicle = dummyVehicles.find(v => v.id === selectedId);
    const userId = auth().currentUser?.uid;

    if (selectedVehicle && userId) {
      try {
           
        let CompanyId = await AsyncStorage.getItem('CompanyId')||'1';
      
        shiftStatusChange(true , selectedVehicle?.id , driver.driverId ,driver.token, 'onboard');
 
      
        // Mark user as online in Firebase
        await database().ref(`companies/${CompanyId}/onlineAgents/${userId}`).set({
          vehicle: selectedVehicle,
          lastOnline: database.ServerValue.TIMESTAMP,
        });

        startShift(selectedVehicle);
        startService();
        // Alert.alert('Shift Started', `You are now online with ${selectedVehicle.name}!`);
        showSuccessToast('Shift Started', `You are now online with ${selectedVehicle.vehicleNumber}!`);
        navigation.replace('Home');
      } catch (error) {
        console.log("error", error);
        console.error('Error marking user online:', error);
        // Alert.alert('Error', 'Failed to go online. Please try again.');
        showErrorToast('Error', 'Failed to go online. Please try again.');
      }
    } else {
      // Alert.alert('Selection Required', 'Please select a vehicle to start your shift.');
      showErrorToast('Selection Required', 'Please select a vehicle to start your shift.');
    }
  }, [selectedId, startShift, navigation]);
  const handleLogout = useCallback(async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLogoutLoading(true);
          try {
            await AsyncStorage.removeItem('DriverData');
            await auth().signOut();
            await stopService();
            Alert.alert('Logged Out', 'You have been successfully logged out.');
            // Navigation will likely be handled by auth state changes
          
          } catch (e) {
            console.error('Logout error:', e);
            Alert.alert('Error', 'Logout failed, please try again.');
          } finally {
            setLogoutLoading(false);
          }
        },
      },
    ]);
  }, []);

  const renderVehicleItem = useCallback(({ item }) => {
    const isSelected = selectedId === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.vehicleItem,
          isSelected && styles.selectedVehicle,
        ]}
        onPress={() => setSelectedId(item.id)}
        activeOpacity={0.7}
      >
        <Icon name={item.icon || 'car'} size={24} color={isSelected ? '#FFD700' : '#ADD8E6'} style={styles.vehicleIcon} />
        <View>
          <Text style={[styles.vehicleName, isSelected && styles.selectedVehicleText]}>{item.vehicleNumber} - { item.vehicleType }</Text>
          <Text style={styles.vehicleType}>{item.vehicleClass} - {item.model} - { item.make }</Text>
          <Text style={styles.vehicleType}>Passenger Capcity: {item.passengerCapacity} - Bag Capcity: {item.bagCapacity}</Text>
          <Text style={styles.vehicleType}>wheel chair Capacity: {item.wheelchairCapacity}  </Text>
          <Text style={styles.vehicleType}>fuelType: {item.fuelType}</Text>
          <Text style={styles.vehicleType}>transmission : {item.transmissionType}</Text>
        </View>
        {isSelected && <Icon name="check-circle" size={24} color="#4CAF50" style={styles.checkIcon} />}
      </TouchableOpacity>
    );
  }, [selectedId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Start Your Shift</Text>
        <TouchableOpacity onPress={handleLogout} disabled={logoutLoading} style={styles.logoutButton}>
          {logoutLoading ? (
            <ActivityIndicator size="small" color="#FF5722" />
          ) : (
            <>
              <Icon name="logout" size={20} color="#FF5722" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Choose Your Vehicle</Text>

      <FlatList
        data={dummyVehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicleItem}
        contentContainerStyle={styles.vehicleList}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.startButton, !selectedId && styles.disabledButton]}
        onPress={handleStartShift}
        disabled={!selectedId}
        activeOpacity={0.7}
      >
        <Icon name="power" size={20} color="#fff" style={styles.startButtonIcon} />
        <Text style={styles.startButtonText}>Go Online</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,87,34,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF5722',
    gap: 5,
  },
  logoutButtonText: {
    color: '#FF5722',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: SPACING,
    marginBottom: SPACING * 0.5,
  },
  vehicleList: {
    paddingHorizontal: SPACING,
    paddingBottom: SPACING * 2,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 15,
    borderRadius: 10,
    marginBottom: ITEM_MARGIN_BOTTOM,
    borderWidth: 1,
    borderColor: '#333',
  },
  vehicleIcon: {
    marginRight: 15,
  },
  vehicleName: {
    fontSize: 16,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    color: '#fff',
  },
  vehicleType: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#ccc',
    marginTop: 3,
  },
  selectedVehicle: {
    borderColor: '#FFD700',
    backgroundColor: '#303030',
  },
  selectedVehicleText: {
    color: '#FFD700',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 30,
    marginHorizontal: SPACING,
    marginTop: 20,
  },
  startButtonIcon: {
    marginRight: 10,
    color: '#fff',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#607D8B',
    opacity: 0.7,
  },
});

export default StartShiftScreen;