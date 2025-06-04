export const ENDPOINTS = {
  REGISTER_DRIVER: '/api/driver/auth/register',
  LOGIN_DRIVER: '/api/driver/auth/login',
  DRIVER_SHIFT_CHANGE: '/api/driver/auth/shiftActivity',
  DRIVER_PROFILE: '/api/driver/auth/profile',
  DRIVER_AVAILABILITY: '/api/driver/auth/availability',
  DRIVER_JOB_ACCEPT: (jobId) => `/api/driver/auth/accept-ride/${jobId}`,
  DRIVER_CURRENT_JOB: '/api/driver/auth/accepted-ride',
  DRIVER_JOB_COMPLETE: '/api/driver/auth/complete-ride',
  DRIVER_COMPLETED_JOBS: '/api/driver/auth/completed-rides',
  DRIVER_RIDE_STATUS_UPDATE: '/api/driver/auth/update-ride-status',
  DRIVER_ASSIGN_VEHICLE: (driverId) => `/api/driver-vehicles/driver/${driverId}/vehicles`,
  DRIVER_VEHICLE_ONBOARD: '/api/driver-vehicles/onboard',
  DRIVER_VEHICLE_OFFBOARD: (driverId , vehicleId ) => `/api/driver-vehicles/onboard/finish/driver/${driverId}/vehicle/${vehicleId}`,
};
 
  
export const JOBENDPOINT = {
 

  GET_DRIVER_ACTIVE_RIDE: (driverId) => `/api/rider/ride/getDriverActiveRide/${driverId}`,
 
  GET_LAST_THREE_RIDE: (driverId) => `/api/rider/ride/getLastThreeRide/${driverId}`,
 
  GET_PENDING_RIDES: `/api/rider/ride/pending-rides`,
  CHANGE_RIDE_STATUS: (rideId , driverId , status) => `/api/rider/ride/changeRideStatus/${rideId}/${driverId}/${status}`,
  CREATE_RIDE: '/api/rider/ride/request',
} 