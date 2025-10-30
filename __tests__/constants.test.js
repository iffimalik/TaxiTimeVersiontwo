import { ENDPOINTS, JOBENDPOINT, REALTIMEJOB, TarrifZone } from '../src/utils/constants';

describe('constants endpoints', () => {
  test('driver endpoints contain expected paths', () => {
    expect(ENDPOINTS.REGISTER_DRIVER).toBe('/api/driver/auth/register');
    expect(ENDPOINTS.LOGIN_DRIVER).toBe('/api/driver/auth/login');
    expect(ENDPOINTS.DRIVER_SHIFT_CHANGE).toBe('/api/driver/auth/shiftActivity');
    expect(ENDPOINTS.DRIVER_STATUS_CHANGE).toBe('/api/driver/auth/driver-status-change');
    expect(ENDPOINTS.DRIVER_JOB_ACCEPT('rid')).toBe('/api/driver/auth/accept-ride/rid');
  });

  test('ride endpoints contain expected paths', () => {
    expect(JOBENDPOINT.CREATE_RIDE).toBe('/api/rider/ride/request');
    expect(JOBENDPOINT.GET_PENDING_RIDES).toBe('/api/rider/ride/pending-rides');
    expect(JOBENDPOINT.CHANGE_RIDE_STATUS('r1','d1','accepted')).toBe('/api/rider/ride/changeRideStatus/r1/d1/accepted');
  });

  test('realtime endpoints', () => {
    expect(REALTIMEJOB.GET_DRIVER_ACTIVE_RIDE('d1')).toBe('/api/rider/ride/getDriverRealTime/d1');
    expect(REALTIMEJOB.UPDATE_DRIVER_ACTIVE_RIDE('d1','j1')).toBe('/api/rider/ride/updateDriverRealTime/d1/j1');
  });

  test('zone detect endpoint', () => {
    expect(TarrifZone.DetectZoneAndTariff).toBe('/api/admin/zones/detect');
  });
});

