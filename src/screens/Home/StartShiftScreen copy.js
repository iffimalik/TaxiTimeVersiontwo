import React,  { useContext, useState  } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert , StatusBar } from 'react-native';
import { ShiftContext } from '../../context/ShiftContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
 import { useFocusEffect } from '@react-navigation/native';
import { startService } from '../../BackgroundService';

const dummyVehicles = [
  { id: 'v1', name: 'Toyota Corolla' },
  { id: 'v2', name: 'Hyundai Elantra' },
  { id: 'v3', name: 'Nissan Sunny' },
];

const StartShiftScreen = ({ navigation }) => {
  const { startShift } = useContext(ShiftContext);
  const [selectedId, setSelectedId] = useState(null);

  const handleStartShift = () => {
    const selected = dummyVehicles.find(v => v.id === selectedId);
    if (selected) {
        startShift(selected);
        startService();
    //   navigation.replace('Home');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
         onPress: async () => {
                // setLogoutLoading(true);
                // try {
                    await auth().signOut();
               
                //     console.log('User signed out successfully');
                // } catch (error) {
           
                //     // Alert.alert('Error', 'Logout failed, please try again.');
                // } finally {
                //     setLogoutLoading(false);
                // }
                }

      },
    ]);
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Vehicle</Text>
      <FlatList
        data={dummyVehicles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.vehicleItem,
              selectedId === item.id && styles.selectedVehicle,
            ]}
            onPress={() => setSelectedId(item.id)}
          >
            <Text style={styles.vehicleText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={[styles.startButton, !selectedId && { opacity: 0.5 }]}
        onPress={handleStartShift}
        disabled={!selectedId}
      >
        <Text style={styles.startButtonText}>Start Shift</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

 

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center'  , marginTop: StatusBar.currentHeight, },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  vehicleItem: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    borderColor: '#ccc',
  },
  selectedVehicle: {
    borderColor: '#2f80ed',
    backgroundColor: '#eaf4ff',
  },
  vehicleText: { fontSize: 18 },
  startButton: {
    marginTop: 30,
    backgroundColor: '#2f80ed',
    paddingVertical: 15,
    borderRadius: 50,
    alignItems: 'center',
  },
  startButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  logoutButton: {
    marginTop: 15,
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
  },
  logoutButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

export default StartShiftScreen;
