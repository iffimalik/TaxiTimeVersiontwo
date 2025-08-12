// websocket context
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useDriverWebSocket as useDriverWebSocketHook } from '../utils/services/socketService';
import useJobStore from '../store/jobStore'; // Import useJobStore

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  // Get the sendWebSocketMessage function from the jobStore (still needed to be set by the Provider)
  const setSendWebSocketMessageInStore = useJobStore((state) => state.setSendWebSocketMessage);
  // Get the handleServerJobUpdate function from the jobStore (for receiving messages)
  const handleServerJobUpdateInStore = useJobStore((state) => state.handleServerJobUpdate);

  // Get the socketMessage state from jobStore. This is what we'll "listen" to.
  const socketMessageFromStore = useJobStore((state) => state.socketMessage);
  // Get connection status to decide if we should try sending
  const isOnlineFromStore = useJobStore((state) => state.isOnline);

  // Initialize the WebSocket hook
  const {
    connectionStatus,
    sendWebSocketMessage, // This is the actual function to send over WS
    wsRef,
    connectWebSocket,
    cleanupWebSocket
  } = useDriverWebSocketHook(handleServerJobUpdateInStore); // Pass handler for INCOMING messages

  // Effect to set the sendWebSocketMessage function in jobStore
  // This makes sendWebSocketMessage available *within* the jobStore's state
  useEffect(() => {
    if (setSendWebSocketMessageInStore && sendWebSocketMessage) {
      setSendWebSocketMessageInStore(() => sendWebSocketMessage);
      console.log('✅ WebSocket send function successfully set in jobStore.');
    }
  }, [sendWebSocketMessage, setSendWebSocketMessageInStore]);

  // 🔥🔥🔥 CRITICAL EFFECT FOR YOUR REQUESTED LOGIC 🔥🔥🔥
  // This useEffect watches socketMessageFromStore and triggers the send.
  useEffect(() => {
    // Check if there's a message to send, if the WebSocket connection is open,
    // and if the app considers itself online.
    // console.log("connectionStatus", connectionStatus , isOnlineFromStore , socketMessageFromStore);
    if (socketMessageFromStore  && connectionStatus == 'connected'  && isOnlineFromStore) {
      try {
        // console.log('Attempting to send message from WebSocketProvider via socketMessage:', socketMessageFromStore);
        sendWebSocketMessage(socketMessageFromStore);
        // console.log('✅ Message sent via WebSocketProvider.');
        // Optionally, if you want to "clear" the socketMessage after sending to prevent
        // resending it on subsequent re-renders without a new trigger:
        // useJobStore.getState().setSocketMessage(null); // This might cause another re-render!
                                                        // Be very careful with this.
      } catch (error) {
        console.error('❌ Error sending message from WebSocketProvider:', error);
      }
    } else if (socketMessageFromStore) {
        // Log if not sending due to connection/online status
        console.warn('Message in socketMessageFromStore but not sending:', {
            message: socketMessageFromStore,
            sendFunctionAvailable: !!sendWebSocketMessage,
            connectionStatus: connectionStatus,
            isOnline: isOnlineFromStore
        });
    }
  }, [socketMessageFromStore, sendWebSocketMessage, connectionStatus, isOnlineFromStore]);


  const value = {
    connectionStatus,
    sendWebSocketMessage, // Still exposed for consistency, though less directly used by children now
    wsRef,
    connectWebSocket,
    cleanupWebSocket
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};