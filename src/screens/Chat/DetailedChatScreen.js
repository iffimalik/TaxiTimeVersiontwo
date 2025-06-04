import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { format } from 'date-fns';

const DetailedChatScreen = ({ route, navigation }) => {
  const { otherUserId, otherUserName } = route.params;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const userId = auth().currentUser?.uid;
  const flatListRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const chatKey = useCallback(() => {
    return [userId, otherUserId].sort().join('_');
  }, [userId, otherUserId]);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        'android.permission.FOREGROUND_SERVICE',
      ];
      if (Platform.Version >= 33) {
        permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);
      const allGranted = permissions.every(
        permission => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        console.warn('Some permissions were not granted.');
      }
      return allGranted;
    }
    return true;
  }, []);

  useEffect(() => {
    checkPermissions();

    if (!userId || !otherUserId) {
      console.warn('Missing userId or otherUserId for chat.');
      navigation.goBack();
      return;
    }

    const currentChatKey = chatKey();
    const chatHistoryRef = database().ref(`chat_history/${currentChatKey}`);

    const fetchAndListenMessages = async () => {
      setLoadingMessages(true);
      try {
        const snapshot = await chatHistoryRef.orderByChild('timestamp').once('value');
        const fetchedMessages = [];
        snapshot.forEach((childSnapshot) => {
          fetchedMessages.push({ ...childSnapshot.val(), id: childSnapshot.key });
        });
        fetchedMessages.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(fetchedMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoadingMessages(false);
      }

      chatHistoryRef.orderByChild('timestamp').startAt(Date.now()).on('child_added', (snapshot) => {
        const newMessageData = { ...snapshot.val(), id: snapshot.key };
        setMessages((prevMessages) => [...prevMessages, newMessageData]);
      });

      const markAsRead = async () => {
        const unreadMessagesRef = chatHistoryRef
          .orderByChild('receiverId')
          .equalTo(userId);
        const snapshot = await unreadMessagesRef.once('value');
        const updates = {};
        snapshot.forEach((childSnapshot) => {
          const message = childSnapshot.val();
          if (!message.read && message.senderId === otherUserId) {
            updates[childSnapshot.key] = { ...message, read: true };
          }
        });
        if (Object.keys(updates).length > 0) {
          await chatHistoryRef.update(updates);
        }
      };
      markAsRead();
    };

    fetchAndListenMessages();

    return () => {
      database().ref(`chat_history/${currentChatKey}`).off();
    };
  }, [userId, otherUserId, chatKey, navigation, checkPermissions]);

  const deleteOldMessages = useCallback(async () => {
    const currentChatKey = chatKey();
    const chatHistoryRef = database().ref(`chat_history/${currentChatKey}`);

    const snapshot = await chatHistoryRef.orderByChild('timestamp').once('value');
    const messagesToDelete = [];
    snapshot.forEach((childSnapshot) => {
      messagesToDelete.push({ key: childSnapshot.key, ...childSnapshot.val() });
    });

    if (messagesToDelete.length > 10) {
      // Sort by timestamp to delete the oldest
      messagesToDelete.sort((a, b) => a.timestamp - b.timestamp);
      const numToDelete = messagesToDelete.length - 10;

      const updates = {};
      for (let i = 0; i < numToDelete; i++) {
        updates[messagesToDelete[i].key] = null; // Setting to null deletes the node
      }

      try {
        await chatHistoryRef.update(updates);
        // console.log(`Deleted ${numToDelete} old messages.`);
      } catch (error) {
        console.error('Error deleting old messages:', error);
      }
    }
  }, [chatKey]);

  const handleSendMessage = useCallback(async () => {
    if (newMessage.trim() && userId && otherUserId) {
      const messageToSend = {
        senderId: userId,
        receiverId: otherUserId,
        text: newMessage.trim(),
        timestamp: database.ServerValue.TIMESTAMP,
        read: false,
      };

      try {
        const newMessageRef = await database().ref(`chat_history/${chatKey()}`).push(messageToSend);
        setNewMessage('');
        // After sending, trigger the deletion of old messages
        deleteOldMessages();
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }, [newMessage, userId, otherUserId, chatKey, deleteOldMessages]);

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loadingMessages]);

  const renderItem = useCallback(({ item }) => {
    const isCurrentUser = item.senderId === userId;
    const messageTime = item.timestamp ? format(new Date(item.timestamp), 'h:mm a') : '';
    const isRead = isCurrentUser || item.read;

    return (
      <View style={[
        styles.messageBubble,
        isCurrentUser ? styles.myMessage : styles.otherMessage,
      ]}>
        <Text style={styles.messageText}>{item.text}</Text>
        <View style={styles.messageInfo}>
          <Text style={styles.messageTime}>{messageTime}</Text>
          {isCurrentUser && (
            <Icon
              name={isRead ? 'check-all' : 'check'}
              size={12}
              color={isRead ? '#4CAF50' : 'lightgray'}
              style={styles.readStatusIcon}
            />
          )}
        </View>
      </View>
    );
  }, [userId]);

  const handleEmojiPress = (emoji) => {
    setNewMessage(prevMessage => prevMessage + emoji);
  };

  const renderEmojiPicker = () => {
    if (!showEmojiPicker) return null;
    const emojis = ['😊', '👍', '❤️', '😂', '🙏'];
    return (
      <View style={styles.emojiPicker}>
        {emojis.map((emoji) => (
          <TouchableOpacity key={emoji} onPress={() => handleEmojiPress(emoji)} style={styles.emojiButton}>
            <Text style={styles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-left" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{otherUserName || 'Chat'}</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Chat Messages List */}
          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {renderEmojiPicker()}

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => setShowEmojiPicker(!showEmojiPicker)} style={styles.emojiToggle}>
              <Icon name="emoticon-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type your message..."
              placeholderTextColor="#888"
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
              <Icon name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  backButton: {
    paddingRight: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#FFD700',
    fontSize: 16,
    marginTop: 10,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 10,
  },
  messageListContent: {
    paddingVertical: 10,
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 18,
    marginBottom: 10,
    maxWidth: '85%',
    minHeight: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  myMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  otherMessage: {
    backgroundColor: '#333',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginRight: 5,
  },
  readStatusIcon: {
    marginLeft: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'flex-end',
    minHeight: 60,
  },
  input: {
    flex: 1,
    backgroundColor: '#252525',
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 25,
    marginRight: 10,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  emojiToggle: {
    padding: 10,
  },
  emojiPicker: {
    backgroundColor: '#121212',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  emojiButton: {
    padding: 5,
  },
  emojiText: {
    fontSize: 20,
  },
});

export default DetailedChatScreen;