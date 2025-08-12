import React, { useEffect, useState, useRef, useCallback , useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useLocationStore from '../../../store/locationStore';
import { showConfirmationToast, showErrorToast } from '../../../utils/showToast';
import { TarrifContext } from '../../../context/TarrifContext';

const LocationHeader = ({ navigation }) => {
  const latitude = useLocationStore((state) => state.latitude);
  const {clearSelectedTarrif , isNeedtoRefresh, selectedTarrif, isTarrifSelected , availableTariffs , detectedZone } = useContext(TarrifContext);
  
  const longitude = useLocationStore((state) => state.longitude);
  const speed = useLocationStore((state) => state.speed);
  const movementState = useLocationStore((state) => state.movementState);
  const [statusColor, setStatusColor] = useState('green');
  const [blink, setBlink] = useState(true);
  const lastUpdateRef = useRef(Date.now());

  // Convert speed from m/s to km/h (or mph if you prefer)
  const speedKmh = speed ? (speed).toFixed(2) : 0;

  // Update timestamp when location changes
  useEffect(() => {
    lastUpdateRef.current = Date.now();
  }, [latitude, longitude]);

  // Update color/blink based on time since last location update
  useEffect(() => {
    const interval = setInterval(() => {
      const secondsSinceLastUpdate = (Date.now() - lastUpdateRef.current) / 1000;

      if (secondsSinceLastUpdate < 2) {
        setStatusColor('green');
        setBlink((prev) => !prev);
      } else if (secondsSinceLastUpdate < 4) {
        setStatusColor('orange');
        setBlink(true);
      } else {
        setStatusColor('red');
        setBlink(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleSOS = () => {
    showConfirmationToast({
      title: '🚨 Emergency SOS',
      message: 'Are you in an emergency? This will alert authorities or support.',
      confirmText: 'Confirm SOS',
      cancelText: 'Cancel',
      confirmType: 'destructive',
      onConfirm: () => {
        showErrorToast('SOS Activated', 'Emergency services have been alerted.');
      },
    });
  };

  return (
    <>
     <View style={styles.tariffSectionCompact}>
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: statusColor,
              opacity: statusColor === 'green' && blink ? 0.3 : 1,
            },
          ]}
        />
        
        {/* Speedometer */}
        <View style={styles.speedometer}>
          <Icon name="speedometer" size={16} color="white" style={styles.speedIcon} />
            <Text style={styles.speedText}>{speedKmh} km/h </Text>
            <Text style={styles.movementText}> {movementState}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.sosButtonCompact} onPress={handleSOS}>
        <Icon name="alert-circle-outline" size={20} color="#FF5722" />
        <Text style={styles.sosButtonTextCompact}>SOS</Text>
      </TouchableOpacity>
    </View>
      <View style={styles.tariffSectionCompact}>
                 <View>
                   <Text style={styles.tariffTextCompact}>Tariff: {selectedTarrif?.name || 'Standard'}</Text>
                   <View style={styles.tariffRatesRow}>
                     <Text style={styles.tariffRateText}>S: ${selectedTarrif.startingPrice}</Text>
                     <Text style={styles.tariffRateText}>D: ${selectedTarrif.distanceRate * 1000}/Km</Text>
                     <Text style={styles.tariffRateText}>T: ${selectedTarrif.timeRate * 60}/min</Text>
                     <Text style={styles.tariffRateText}>W: ${parseFloat(selectedTarrif.waitingRate * 60).toFixed(2)}/min</Text>
                   </View>
                 </View>
                 <TouchableOpacity style={styles.changeTariffButtonCompact} onPress={clearSelectedTarrif}>
                   <Icon name="chart-bar" size={16} color="#fff" />
                 </TouchableOpacity>
              </View></>
  );
};

const styles = StyleSheet.create({
  headerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  speedometer: {
    flexDirection: 'row',
    alignItems: 'center',
    
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  speedIcon: {
    marginRight: 4,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    
  },
   movementText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  sosButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#330000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  sosButtonTextCompact: {
    color: '#FF5722',
    marginLeft: 4,
    fontWeight: 'bold',
    fontSize: 12,
  },
    tariffSectionCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(20,20,20,0.9)',
    paddingVertical: 8, // Reduced padding
    paddingHorizontal: 15,
    borderRadius: 8, // Smaller border radius
    marginHorizontal: 15,
    marginTop: 8,
  },
  tariffTextCompact: {
    color: '#FFD700',
    fontSize: 14, // Smaller font
    fontWeight: 'bold',
  },
  tariffRatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow wrapping for small screens
    marginTop: 2,
  },
  tariffRateText: {
    fontSize: 9, // Very small font for rates
    color: 'white',
    marginRight: 8, // Spacing between rate items
  },
  changeTariffButtonCompact: {
    backgroundColor: 'green',
    padding: 6, // Smaller padding
    borderRadius: 12, // Smaller border radius
  },
});

export default LocationHeader;