import React, { useContext, useEffect, useState } from 'react';
import { View, Text ,   StyleSheet } from 'react-native';
import { ShiftContext } from '../../../context/ShiftContext';

const ShiftOverview = () => {
  const { shiftStarted, shiftStartTime, shiftCloseTime } = useContext(ShiftContext);
  const [totalShiftTime, setTotalShiftTime] = useState('');

  useEffect(() => {
    if (!shiftStartTime) {
      setTotalShiftTime('0h 0m');
      return;
    }

    const calculateDuration = () => {
      const start = new Date(shiftStartTime);
      const end = shiftCloseTime ? new Date(shiftCloseTime) : new Date();
      const diffMs = end - start; // difference in milliseconds

      // Calculate hours and minutes
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      return `${diffHrs}h ${diffMins}m`;
    };

    setTotalShiftTime(calculateDuration());

    // If shift is ongoing, update every minute
    let interval;
    if (shiftStarted && !shiftCloseTime) {
      interval = setInterval(() => {
        setTotalShiftTime(calculateDuration());
      }, 60000); // every 60 seconds
    }

    return () => interval && clearInterval(interval);

  }, [shiftStarted, shiftStartTime, shiftCloseTime]);

  return (
    <View style={[styles.overviewItem, styles.card1]}>
      <Text style={styles.overviewValue}>{totalShiftTime}</Text>
      <Text style={styles.overviewLabel}>Drive Time</Text>
    </View>
  );
};
const styles = StyleSheet.create({
 
   card1: {
     width: '28%',
    margin:3,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 1,
  },
 
   overviewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  overviewItem: { alignItems: 'center' , flex: 1 },
  overviewValue: { fontSize: 16, fontWeight: 'bold', color: '#333' }

});
export default ShiftOverview;
