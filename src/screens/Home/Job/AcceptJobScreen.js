import React, { useEffect, useState, useMemo , useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
 import MapView, { Marker, Polyline } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import useJobStore from '../../../store/jobStore';
import useLocationStore from '../../../store/locationStore';
import haversine from 'haversine-distance';

const AcceptJobScreen = () => {
  const navigation = useNavigation();
const { currentJob, setJobStatus, jobStatus, clearJob  , updateCurrentJob } = useJobStore();
  const { latitude, longitude } = useLocationStore();
  const [counter, setCounter] = useState(30);
const mapRef = useRef(null);
  useEffect(() => {
     if (!currentJob || !latitude || !longitude) return;

  const timeout = setTimeout(() => {
    mapRef.current?.fitToCoordinates(
      [
        { latitude, longitude }, // Driver's current location
        { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng } // Pickup location
      ],
      {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      }
    );
  }, 500);

    const timer = setInterval(() => {
      setCounter((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // You can uncomment the next line if you want auto reject on timeout
          // handleReject(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentJob]);
const handleAccept = () => {
  // Alert.alert('✅ Job Accepted');
  setJobStatus('on_the_way');
  const acceptedTime = new Date().toISOString();
  // Add acceptedTime to currentJob
  updateCurrentJob({ acceptedTime });
};

// On the Way → Sets arrived status
const handleOnTheWay = () => {
  setJobStatus('arrived_ready'); // Not yet arrived
    const on_the_way = new Date().toISOString();
  // Add acceptedTime to currentJob
  updateCurrentJob({ on_the_way_time: on_the_way });
};

// Arrived (when within 300m)
const handleArrived = () => {
  setJobStatus('arrived');
   const arrived = new Date().toISOString();
  // Add acceptedTime to currentJob
  updateCurrentJob({ arrivedTime: arrived });
};
  
  const handleOnStart = () => {
    setJobStatus('started');
    const started = new Date().toISOString();
    // Add acceptedTime to currentJob
    updateCurrentJob({ driver_job_start_time: started });
    navigation.navigate('JobTrackingScreen', { job: currentJob });
    
};
  
 
// Check if within 300m
const isNearby = () => {
  const distance = haversine({ latitude, longitude }, {
              latitude: currentJob.pickupLat,
              longitude: currentJob.pickupLng,
            }); // in meters
  return distance <= 9509; // 4509 meters = 4.5 km
};
  // Create an arc-shaped coordinate array for the Polyline
  function createArcCoordinates(start, end, height = -0.01, points = 30) {
    const coords = [];

    for (let i = 0; i <= points; i++) {
      const t = i / points;

      // Linear interpolation between start and end
      const lat = start.latitude + (end.latitude - start.latitude) * t;
      const lng = start.longitude + (end.longitude - start.longitude) * t;

      // Parabolic height offset for arc (peak at midpoint)
      const arcHeight = height * 4 * (t - 0.5) * (t - 0.5) - height;

      coords.push({
        latitude: lat + arcHeight,
        longitude: lng,
      });
    }
    return coords;
  }

  if (!currentJob || !latitude || !longitude) return null;

  const start = { latitude, longitude };
  const end = { latitude: currentJob.pickupLat, longitude: currentJob.pickupLng };
  const arcCoordinates = useMemo(() => createArcCoordinates(start, end), [start, end]);

//   const handleAccept = () => {
//     Alert.alert('✅ Job Accepted', `Job ID: ${currentJob.id}`);
//     navigation.navigate('JobTrackingScreen');
//   };

  const handleReject = (auto = false) => {
    if (!auto) {
      Alert.alert('❌ Job Rejected', 'You rejected the job.');
    } else {
      Alert.alert('⏱️ Timed Out', 'You didn’t respond in time.');
    }
    clearJob();
    navigation.navigate('Home');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🚖 New Ride Request</Text>
      <Text style={styles.counter}>Auto rejecting in {counter}s</Text>

      <View style={styles.mapContainer}>
        <MapView
           ref={mapRef}
            style={styles.map}
            initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }}
        >
          {/* Driver Location */}
          <Marker
            coordinate={{ latitude, longitude }}
            title="Your Location"
            pinColor="blue"
          />

          {/* Pickup Marker */}
          <Marker
            coordinate={{
              latitude: currentJob.pickupLat,
              longitude: currentJob.pickupLng,
            }}
            title="Pickup Location"
            description={currentJob.pickupLocation}
            pinColor="green"
          />

          {/* Arc Polyline */}
          <Polyline
            coordinates={arcCoordinates}
            strokeColor="#1abc9c"
            strokeWidth={3}
            geodesic={false} // geodesic false because you're manually creating the arc
          />
        </MapView>
      </View>

      <View style={styles.card}>
        <LabelValue label="Pickup" value={currentJob.pickupLocation} />
        <LabelValue label="Dropoff" value={currentJob.dropoffLocation} />
        <View style={styles.row}>
          <Badge text={`Distance: ${currentJob.distance}`} />
          <Badge text={`ETA: ${currentJob.estimatedDuration}`} />
        </View>
        <LabelValue label="Fare" value={`QAR ${currentJob.estimatedFare}`} />
        <LabelValue
          label="Rider"
          value={`${currentJob.riderName} (${currentJob.riderPhone})`}
        />
        <LabelValue
          label="Vehicle"
          value={`${currentJob.vehicle.color} ${currentJob.vehicle.model} (${currentJob.vehicle.plate})`}
        />
        {currentJob.notes && <LabelValue label="Notes" value={currentJob.notes} />}
      </View>

     <View style={styles.buttonContainer}>
        {jobStatus === 'pending' && (
            <>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Text style={styles.btnText}>✅ Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(false)}>
                <Text style={styles.btnText}>❌ Reject</Text>
            </TouchableOpacity>
            </>
        )}

        {jobStatus === 'on_the_way' && (
            <TouchableOpacity style={styles.acceptBtn} onPress={handleOnTheWay}>
            <Text style={styles.btnText}>🚗 On the Way</Text>
            </TouchableOpacity>
        )}
        
        {jobStatus === 'arrived_ready' && (
          <TouchableOpacity
            style={[
              { width: '100%',
              height: 50},
              styles.acceptBtn,
              !(jobStatus === 'arrived_ready' && isNearby()) && styles.disabledBtn
            ]}
            onPress={handleArrived}
            disabled={!(jobStatus === 'arrived_ready' && isNearby())}
          >
            <Text
              style={[
                styles.btnText,
                !(jobStatus === 'arrived_ready' && isNearby()) && styles.disabledText
              ]}
            >
              📍 Arrived
            </Text>
          </TouchableOpacity>
        )}
         {jobStatus === 'arrived' && (
            <TouchableOpacity style={styles.acceptBtn} onPress={handleOnStart}>
            <Text style={styles.btnText}>🚗 Start</Text>
            </TouchableOpacity>
        )}
        
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
    marginTop: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30,
    backgroundColor: '#f9f9fb',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: 8,
  },
  acceptBtn: {
  backgroundColor: '#2E86DE', // Active blue
  padding: 14,
  borderRadius: 10,
  alignItems: 'center',
  marginVertical: 10,
},

btnText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
},

disabledBtn: {
  backgroundColor: '#ccc', // dull grey
  opacity: 0.7,
},

disabledText: {
  color: "#888", // faded text color
}
,
  counter: {
    fontSize: 14,
    textAlign: 'center',
    color: '#e74c3c',
    marginBottom: 16,
  },
  mapContainer: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    color: '#2c3e50',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 13,
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
  
});
