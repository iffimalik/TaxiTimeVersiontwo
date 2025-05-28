import React from 'react';
import { Text } from 'react-native';
import useLocationStore from '../../../store/locationStore'; // adjust path

const LocationDisplay = () => {
  const locationStore = useLocationStore();

  const latitude = locationStore?.latitude;
  const longitude = locationStore?.longitude;

 

  if (latitude === null || longitude === null) {
    return <Text style={{ fontSize: 16, color: '#2f80ed' }}>Fetching location...</Text>;
  }

  return (
    <Text style={{ fontSize: 16, color: '#2f80ed' }}>
      {`${latitude}, ${longitude}`}
    </Text>
  );
};

export default LocationDisplay;
