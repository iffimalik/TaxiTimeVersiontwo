// src/services/cleanup.js
import database from '@react-native-firebase/database';

export const cleanupOldFirebaseNodes = async () => {
  try {
    await database().ref('joback').remove();
    console.log('✅ Old "joback" node deleted from Firebase.');
  } catch (error) {
    console.error('❌ Failed to delete "joback" node:', error);
  }
};
