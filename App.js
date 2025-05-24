import React from 'react';
import { Button, View, StyleSheet } from 'react-native';
import { startService , stopService } from './src/BackgroundService';

const App = () => (
  <View style={styles.container}>
    <Button 
      title="Start Background Task" 
      onPress={() => {

        alert("asdsad");
        try {
              startService();
        } catch (Ex) {
          console.log(Ex.message);
          }
      }} 
    />
    <Button
      title="Stop Background Task"
      onPress={stopService}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
});

export default App;