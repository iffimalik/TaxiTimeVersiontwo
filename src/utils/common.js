// common.js (or utils/shiftActions.js)
import api from "../services/api";
import { ENDPOINTS, JOBENDPOINT } from "./constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showErrorToast } from "./showToast";

// shiftStatusChange does NOT use hooks anymore
export const shiftStatusChange = async (status, vehicleId, driverId, token, jobstatus = 'onboard') => {
  try {
    const response = await api.put(
      ENDPOINTS.DRIVER_SHIFT_CHANGE,
      { shiftActivity: status },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    if (jobstatus === 'offboard') {
      await api.delete(
        ENDPOINTS.DRIVER_VEHICLE_OFFBOARD(driverId, vehicleId),
        { driverId, vehicleId },
        {
          Authorization: `Bearer ${token}`,
        }
      );
    } else {
      await api.post(
        ENDPOINTS.DRIVER_VEHICLE_ONBOARD,
        { driverId, vehicleId },
        {
          Authorization: `Bearer ${token}`,
        }
      );
    }

    return response;
  } catch (error) {
    console.error('Error updating shift status:', error);
    showErrorToast('Error', 'Failed to update shift. Please try again.');
    return null;
  }
};

 export const changeRideStatus = async (status, jobId, driverId, token , joobject) => {
  try {
    const response = await api.put(
      JOBENDPOINT.CHANGE_RIDE_STATUS(jobId, driverId, status),
      joobject,
      {
        Authorization: `Bearer ${token}`,
      }
    );
    return null;
  } catch (error) {
    console.error('Error changing ride status:', error);
    return null;
  }
};
