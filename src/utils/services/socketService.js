import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showErrorToast, showInfoToast } from '../showToast';
import { TarrifContext } from '../../context/TarrifContext';
import {JobContext, useJob} from '../../context/jobContext';
import { ShiftContext } from '../../context/ShiftContext';
import useLocationStore from '../../store/locationStore';
import { startService, stopService } from '../../BackgroundService';
import { BASE_URL, BASE_URL_SOCKET } from '../../services/api';
// import Sound from 'react-native-sound'; // Removed as it was not used
import { changeRideStatus } from '../common';

export const useDriverWebSocket = (onJobMessageReceived) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const currentReconnectDelay = useRef(1000); // Start with 1 second delay
  const MAX_RECONNECT_DELAY = 30000; // Max 30 seconds delay
  const { selectedTarrif, setSelectedTarrif, availableTariffs } = useContext(TarrifContext);
  
  const { driver } = useContext(ShiftContext);
  // const { setIsBackgroundServiceRunning } = useLocationStore(); // This import seems unused in the provided code

  /**
   * Cleans up the current WebSocket connection and any active reconnect timers.
   */
  const cleanupWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      // Remove all event listeners to prevent memory leaks and unexpected behavior
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  /**
   * Constructs a standardized job object from raw WebSocket response data.
   * Prioritizes the tariff specified in the job data, falling back to the globally selected tariff.
   *
   * @param {object} response - The raw job data received from the WebSocket.
   * @returns {object|null} A formatted job object, or null if the response is invalid.
   */
  const createJobObject = useCallback(
    async (response) => {
      if (!response) return null;

      try {
        const {
          id,
          pickupLocation,
          dropoffLocation,
          createdAt,
          pickupTime,
          dropoffTime,
          fare,
          earningsSoFar,
          status,
          distance,
          duration,
          rider,
          notes,
          paymentStatus,
          paymentMethod,
          RideType,
          tariffId,
          passengerCount,
          bagCount,
          wheelchairCount,
          wheelchairAccessNeeded,
          towingOption,
          jobStatusLog,
          driverId,
        } = response;

        let jobSelectedTarrif = selectedTarrif; // Default to currently selected tariff

        // If a specific tariffId is provided in the job, try to find and use it
        if (tariffId && availableTariffs && availableTariffs.length > 0) {
          const foundTariff = availableTariffs.find((t) => t.id === tariffId);
          if (foundTariff) {
            jobSelectedTarrif = foundTariff;
            // Optionally update the global context's selected tariff if the job dictates it
            if (setSelectedTarrif) {
              setSelectedTarrif(foundTariff);
            }
          }
        }

        const jobObject = {
          id: id || '',
          pickupLocation: pickupLocation?.address || 'N/A',
          dropoffLocation: dropoffLocation?.address || 'N/A',
          pickupLat: pickupLocation?.latitude || 0,
          pickupLng: pickupLocation?.longitude || 0,
          dropoffLat: dropoffLocation?.latitude || 0,
          dropoffLng: dropoffLocation?.longitude || 0,
          destination: dropoffLocation?.address || 'N/A',
          CreatedAt: createdAt || new Date().toISOString(),
          pickupTime: pickupTime || '',
          dropoffTime: dropoffTime || '',
          earningsSoFar: earningsSoFar || '0.00',
          estimatedFare: fare ?? '0.00',
          status: status === 'sending' ? 'displayed' : status || 'pending',
          distance: distance ?? '0.0',
          estimatedDuration: duration || 'N/A',
          riderName: rider?.name || 'Guest User',
          riderPhone: rider?.phoneNumber || '+974 123123123',
          notes: notes || '',
          vehicle: {
            model: jobSelectedTarrif?.name ? `${jobSelectedTarrif.name} Tier` : 'Standard Vehicle',
            color: 'White', // Default or fetch from tariff
          },
          destinationLat: dropoffLocation?.latitude || 0,
          destinationLng: dropoffLocation?.longitude || 0,
          coordinateHistory: [],
          driver_job_end_time: null,
          tariff: tariffId || jobSelectedTarrif?.id,
          selectedTarrif: jobSelectedTarrif,
          driver_job_start_time: new Date().toISOString(),
          fair: earningsSoFar || '0.00',
          paymentStatus,
          paymentMethod,
          RideType,
          tariffId: tariffId || jobSelectedTarrif?.id,
          passengerCount,
          bagCount,
          wheelchairCount,
          wheelchairAccessNeeded,
          towingOption,
          jobStatusLog,
          driverId: driverId || driver?.driverId || '', // Use driver from ShiftContext as fallback
        };

        console.log('🚗 JOB Object created in useDriverWebSocket:', jobObject);
        return jobObject;
      } catch (error) {
        console.error('❌ Error creating job object in useDriverWebSocket:', error.message);
        return null;
      }
    },
    [selectedTarrif, availableTariffs, setSelectedTarrif, driver]
  );

  /**
   * Initiates and manages the WebSocket connection, including authentication,
   * message handling, and automatic re-connection logic.
   */
  const connectWebSocket = useCallback(async () => {
    cleanupWebSocket();

    setConnectionStatus('connecting');
    showInfoToast('Connecting...', 'Attempting to establish real-time connection.');
    const protocol = BASE_URL.startsWith('https') ? 'wss:' : 'ws:'; 
    console.log("protocol", protocol); 
 
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        console.warn('No auth token found, cannot establish WebSocket connection.');
        setConnectionStatus('authenticated_failed');
        showErrorToast('Authentication Failed', 'Please log in again.');
        return;
      }


      console.log("`${protocol}${BASE_URL_SOCKET}/realtime?token=${authToken}`", `${protocol}${BASE_URL_SOCKET}/realtime?token=${authToken}`);
      const socket = new WebSocket(`${protocol}//${BASE_URL_SOCKET}/realtime?token=${authToken}`);

      socket.onopen = () => {
        setConnectionStatus('connected');
        wsRef.current = socket;
        currentReconnectDelay.current = 1000;

        socket.send(
          JSON.stringify({
            type: 'authenticate',
            token: authToken,
          })
        );
        socket.send(
          JSON.stringify({
            type: 'subscribe',
            data: { driver: true },
          })
        );
        startService();
      };

      socket.onmessage = async (event) => {
        try {
          console.log("event", event);  
          const { event: eventType, data } = JSON.parse(event.data);
          // console.log('WS Message:', eventType, data);

          switch (eventType) {
            case 'job_assigned':
              const newJob = await createJobObject(data);
              if (newJob) {
                console.log("this is the new job");
                onJobMessageReceived({ type: 'job_assigned', job: newJob });
                showInfoToast('New Job!', `You have a new job from ${data.pickupLocation.address}`);
                console.log("driver", driver);
                if (driver?.driverId && driver?.token) {
                  await changeRideStatus('displayed', newJob.id, driver.driverId, driver.token, newJob);
                } else {
                  console.warn('Driver ID or Token not available for changeRideStatus.');
                }
              }
              break;
            case 'job_taken':
             
              break;
            case 'job_updated':
              const updatedJob = await createJobObject(data.job);
              if (updatedJob) {
                onJobMessageReceived({ type: 'job_updated', job: updatedJob });
                showInfoToast('Job Update', `Job ${data.job.id} status changed to ${data.job.status}`);
              }
              break;
            case 'ride_cancelled':
              onJobMessageReceived({ type: 'ride_cancelled', jobId: data.jobId });
              showInfoToast('Job Cancelled', `Your assigned job ${data.jobId} has been cancelled.`);
              break;
            case 'auth_error':
              console.error('WebSocket Authentication Error:', data.message);
              setConnectionStatus('authentication_error');
              showErrorToast('Auth Error', data.message || 'Authentication failed. Please re-login.');
              stopService();
              cleanupWebSocket();
              break;
            default:
              console.log('Unhandled WebSocket event:', eventType);
          }
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError, event.data);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setConnectionStatus('error');
        showErrorToast('Connection Error', 'Real-time connection encountered an error.');
        stopService();
      };

      socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('disconnected');
        showInfoToast('Disconnected', 'Real-time connection lost. Reconnecting...');

        currentReconnectDelay.current = Math.min(
          currentReconnectDelay.current * 2,
          MAX_RECONNECT_DELAY
        );
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, currentReconnectDelay.current);
      };

      wsRef.current = socket;
    } catch (error) {
      console.error('Failed to initiate WebSocket connection:', error.message);
      setConnectionStatus('error');
      showErrorToast('Connection Failed', 'Could not initiate real-time connection.');
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, currentReconnectDelay.current);
    }
  }, [onJobMessageReceived, createJobObject, cleanupWebSocket, driver]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      cleanupWebSocket();
    };
  }, [connectWebSocket, cleanupWebSocket]);

  /**
   * Sends a message over the established WebSocket connection.
   *
   * @param {object} message - The message object to send. It will be JSON.stringified.
   */
   const sendWebSocketMessage = useCallback(
     (message) => {
      //  console.log("Sending WebSocket messagexxxxxxx:", message);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(message));
          // console.log('WS Message Sent:', message);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          showErrorToast('Send Error', 'Failed to send message over WebSocket.');
        }
      } else {
        console.warn('WebSocket not open. Message not sent:', message);
        showErrorToast('Offline', 'Cannot send message: not connected to real-time server.');
        connectWebSocket()
      }
    },
    []
  );

  return { connectionStatus, sendWebSocketMessage ,  wsRef, connectWebSocket, cleanupWebSocket};
};