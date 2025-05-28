import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView  , StatusBar} from 'react-native';
import useJobStore from '../../../store/jobStore';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';

const AcceptJobScreen = () => {
  const navigation = useNavigation();
  const { currentJob, clearJob } = useJobStore();
  const [counter, setCounter] = useState(30);

  useEffect(() => {
    if (!currentJob) return;

    const timer = setInterval(() => {
      setCounter(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentJob]);

  const handleAccept = () => {
    Alert.alert('Job Accepted', `Job ID: ${currentJob?.id}`);
    navigation.navigate('JobTrackingScreen');
  };

  const handleReject = () => {
    Alert.alert('Job Rejected', 'Job was rejected or timed out.');
    clearJob();
    navigation.navigate('Home');
  };

  if (!currentJob) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Ride Request</Text>
      <Text style={styles.counter}>Accepting in {counter}s</Text>

      {currentJob.pickupLat && currentJob.pickupLng && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: currentJob.pickupLat,
              longitude: currentJob.pickupLng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={{
                latitude: currentJob.pickupLat,
                longitude: currentJob.pickupLng,
              }}
              title="Pickup Location"
              description={currentJob.pickupLocation}
            />
          </MapView>
        </View>
      )}

      <View style={styles.card}>
        <LabelValue label="Pickup" value={currentJob.pickupLocation} />
        <LabelValue label="Dropoff" value={currentJob.dropoffLocation} />
        <View style={styles.row}>
          <Badge text={`Distance: ${currentJob.distance}`} />
          <Badge text={`ETA: ${currentJob.estimatedDuration}`} />
        </View>
        <LabelValue label="Fare" value={currentJob.estimatedFare} />
        <LabelValue label="Rider" value={`${currentJob.riderName} (${currentJob.riderPhone})`} />
        <LabelValue label="Vehicle" value={`${currentJob.vehicle.color} ${currentJob.vehicle.model} (${currentJob.vehicle.plate})`} />
        {currentJob.notes && <LabelValue label="Notes" value={currentJob.notes} />}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
          <Text style={styles.btnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
          <Text style={styles.btnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const LabelValue = ({ label, value }) => (
  <View style={styles.section}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const Badge = ({ text }) => (
  <Text style={styles.badge}>{text}</Text>
);

export default AcceptJobScreen;
const styles = StyleSheet.create({
  container: {
        padding: 20,
        marginTop: StatusBar.currentHeight+10,
    backgroundColor: '#f4f6f8',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: 8,
  },
  counter: {
    fontSize: 16,
    textAlign: 'center',
    color: '#e74c3c',
    marginBottom: 16,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#2c3e50',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 14,
    color: '#34495e',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 10,
  },
  acceptBtn: {
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: '#c0392b',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
