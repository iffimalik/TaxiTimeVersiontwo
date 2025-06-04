import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChatScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [driversWithUnread, setDriversWithUnread] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = auth().currentUser?.uid;

  useEffect(() => {
    const fetchDriversAndUnread = async () => {
      setLoading(true);
      const companyId = await AsyncStorage.getItem('CompanyId') || '1';

      const onlineDriversRef = database().ref(`companies/${companyId}/onlineAgents`);

      try {
        const driversSnapshot = await onlineDriversRef.once('value');
        const driversData = driversSnapshot.val();
        const fetchedDrivers = [];

        if (driversData) {
          const driverIds = Object.keys(driversData).filter(id => id !== userId);

          // Fetch unread counts for each driver
          const driversWithCounts = await Promise.all(
            driverIds.map(async (driverId) => {
              const chatKey = [userId, driverId].sort().join('_');
              const chatRef = database().ref(`chat_history/${chatKey}`);
              let unreadCount = 0;
              let lastMessage = null;

              // Listen for real-time updates for unread count and last message
              const listener = chatRef.orderByChild('timestamp').on('value', (messagesSnapshot) => {
                let currentUnread = 0;
                let currentLastMessage = null;
                messagesSnapshot.forEach(messageSnap => {
                  const message = messageSnap.val();
                  if (message.receiverId === userId && !message.read) {
                    currentUnread++;
                  }
                  if (!currentLastMessage || message.timestamp > currentLastMessage.timestamp) {
                    currentLastMessage = message;
                  }
                });

                // Update the state for this specific driver
                setDriversWithUnread(prevDrivers => {
                  const existingIndex = prevDrivers.findIndex(d => d.id === driverId);
                  const updatedDriver = {
                    id: driverId,
                    name: driversData[driverId]?.name || `Driver ${driverId.substring(0, 8)}`,
                    unreadCount: currentUnread,
                    lastMessageTime: currentLastMessage?.timestamp || 0,
                  };

                  if (existingIndex > -1) {
                    const newDrivers = [...prevDrivers];
                    newDrivers[existingIndex] = updatedDriver;
                    // Re-sort the array
                    newDrivers.sort((a, b) => {
                      if (b.unreadCount > a.unreadCount) return 1;
                      if (a.unreadCount > b.unreadCount) return -1;
                      return b.lastMessageTime - a.lastMessageTime;
                    });
                    return newDrivers;
                  } else {
                    return [...prevDrivers, updatedDriver].sort((a, b) => {
                      if (b.unreadCount > a.unreadCount) return 1;
                      if (a.unreadCount > b.unreadCount) return -1;
                      return b.lastMessageTime - a.lastMessageTime;
                    });
                  }
                });
              });
              return { chatKey, listener }; // Return listener info for cleanup
            })
          );
        } else {
          setDriversWithUnread([]);
        }
      } catch (error) {
        console.error('Error fetching drivers and unread counts:', error);
        setDriversWithUnread([]);
      } finally {
        setLoading(false);
      }
    };

    let allChatListeners = []; // To store all listeners for cleanup

    fetchDriversAndUnread().then(listeners => {
      if (listeners) {
        allChatListeners = listeners; // Store the listeners returned by Promise.all
      }
    });

    return () => {
      // Cleanup all listeners when component unmounts
      allChatListeners.forEach(({ chatKey, listener }) => {
        database().ref(`chat_history/${chatKey}`).off('value', listener);
      });
    };
  }, [userId]);


  const handleStartChat = useCallback(async (otherUserId, otherUserName) => {
    const chatKey = [userId, otherUserId].sort().join('_');
    const chatRef = database().ref(`chat_history/${chatKey}`);

    try {
      // Mark all unread messages for the current user in this chat as read
      const unreadMessagesSnapshot = await chatRef
        .orderByChild('receiverId')
        .equalTo(userId)
        .once('value');

      const updates = {};
      unreadMessagesSnapshot.forEach((messageSnap) => {
        const message = messageSnap.val();
        if (!message.read) {
          updates[messageSnap.key] = { ...message, read: true };
        }
      });

      if (Object.keys(updates).length > 0) {
        await chatRef.update(updates);
        // console.log(`Marked ${Object.keys(updates).length} messages as read for chat ${chatKey}`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }

    // Navigate to the detailed chat screen
    navigation.navigate('DetailedChatScreen', { otherUserId, otherUserName });
  }, [userId, navigation]); // Added userId to dependencies


  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleStartChat(item.id, item.name)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Icon name="car" size={30} color="#fff" />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
        </View>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>{item.unreadCount}</Text>
        </View>
      )}
      <Icon name="message-outline" size={24} color="#888" />
    </TouchableOpacity>
  ), [handleStartChat]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chats</Text>
          <TouchableOpacity onPress={() => navigation.navigate('NewChatScreen')} activeOpacity={0.7}>
            <Icon name="plus" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* List of Drivers with Unread Messages */}
        <FlatList
          data={driversWithUnread}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.contactList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={driversWithUnread.length === 0 ? styles.emptyListContainer : null}
          ListEmptyComponent={() => (
            <View style={styles.emptyList}>
              <Icon name="account-off-outline" size={50} color="#888" />
              <Text style={styles.emptyText}>No online drivers found.</Text>
              <Text style={styles.emptySubText}>Start a new chat by tapping the '+' icon.</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#252525',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  contactInfo: {
    marginLeft: 15,
    flex: 1,
  },
  contactName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unreadCount: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 10,
  },
  emptySubText: {
    color: '#666',
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
});

export default ChatScreen;