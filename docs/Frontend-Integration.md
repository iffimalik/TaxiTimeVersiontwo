TaxiTime Driver App — Frontend Integration Notes

Overview

- App: React Native driver application powering TaxiTime’s driver experience on Android and iOS.
- HTTP: axios wrapper (`src/services/api.js`) uses `API_BASE_URL` (`APP_ORIGIN + API_PATH`).
- WebSocket: `src/utils/services/socketService.js` derives `WS_BASE_URL` from `APP_ORIGIN` + `WS_PATH` and appends `?token=`.
- State: Zustand stores for job and location (`src/store/jobStore.js`, `src/store/locationStore.js`) plus React contexts (WebSocket, shift, tariff).
- Background processing: `react-native-background-actions` runs `mainBackgroundTask` (`src/utils/services/movementTracker.js`) to process location updates and job metrics (`src/utils/services/jobProcessor.js`).
- Use alongside `docs/Backend_API_Guide.md` for a complete frontend ↔ backend contract.

Runtime Config

- HTTP base: `API_BASE_URL` derived from [`APP_ORIGIN`, `API_PATH`] via `react-native-config`.
- WS base: `WS_BASE_URL` derived from [`APP_ORIGIN`, `WS_PATH`].
- Default `.env.example` targets emulator (10.0.2.2:3000). For production, set a single origin per environment. Example:
  - ORIGIN=https://taxitime.co.nz
  - axios baseURL = `${ORIGIN}/api`
  - ws URL = `${ORIGIN.startsWith('https') ? 'wss' : 'ws'}://${new URL(ORIGIN).host}/realtime?token=...`
  - Copy `.env.example` → `.env` and adjust per dev/staging/prod.

Auth

- JWT is persisted in AsyncStorage under authToken and also within DriverData JSON (token field)
- API calls not using a global interceptor; each call passes Authorization header explicitly where required
- WebSocket authenticates via token query parameter and immediately sends
  - { type: 'authenticate', token }
  - { type: 'subscribe', data: { driver: true } }

HTTP Endpoints (from `src/utils/constants.js`)

Unless noted, requests include `Authorization: Bearer <token>` and expect JSON bodies.

- Driver
  - `POST /api/driver/auth/register`
  - `POST /api/driver/auth/login`
  - `PUT /api/driver/auth/shiftActivity`
    - Body: `{ shiftActivity: boolean }`
  - `GET /api/driver/auth/profile`
  - `PUT /api/driver/auth/location`
    - Body: `{ latitude, longitude, accuracy, speed (km/h), heading, movementState }`
  - `PUT /api/driver/auth/driver-status-change`
    - Body: `{ status: 'available'|'away'|'onRide'|'offline'|'suspended' }`
  - `POST /api/driver/auth/accepted-ride`
    - Body includes optional `{ date, limit, offset }`; returns driver’s accepted rides for the day.
  - `POST /api/driver/auth/completed-rides`
  - `POST /api/driver/auth/accept-ride/:rideId`
  - `POST /api/driver-vehicles/onboard`
  - `DELETE /api/driver-vehicles/onboard/finish/driver/:driverId/vehicle/:vehicleId`

- Rides / Job lifecycle
  - `GET /api/rider/ride/getDriverRealTime/:driverId`
  - `PUT /api/rider/ride/updateDriverRealTime/:driverId/:jobId`
    - Body mirrors ride object; backend should merge to persist pricing/coordinate changes.
  - `GET /api/rider/ride/getDriverActiveRide/:driverId`
  - `GET /api/rider/ride/getLastThreeRide/:driverId`
  - `GET /api/rider/ride/pending-rides`
  - `GET /api/rider/ride/todaystates/:driverId`
  - `PUT /api/rider/ride/changeRideStatus/:rideId/:driverId/:status`
    - Primary status progression endpoint; body contains job snapshot with pricing fields (see “Sample Job Payload”).
  - `POST /api/rider/ride/request`
    - Dispatcher-created jobs; returns ride object consumed by driver UI.
  - Payment flows (Stripe):
    - `POST /api/rider/ride/create-payment-intent`
    - `POST /api/rider/ride/create-nfc-payment-intent`
    - `POST /api/rider/ride/scan-create-payment-intent`

- Zones & Tariffs
  - `POST /api/admin/zones/detect`
    - Body: `{ lat, lng }`; app expects response `{ message, zone, tariffs? }`.

WebSocket Protocol (driver)

- Connect: `ws(s)://{HOST}/realtime?token={JWT}`
- Client handshake (sent immediately after `onopen`):
  ```json
  { "type": "authenticate", "token": "<jwt>" }
  { "type": "subscribe", "data": { "driver": true } }
  ```
- Heartbeat: client sends `{ "type": "ping" }` every 15s and responds with `{ "type": "pong" }` when server pings; connection is considered stale after ~45s of silence and auto-reconnects.
- Server events → frontend actions:
  - **job_assigned**
    - Payload example:
      ```json
      {
        "event": "job_assigned",
        "data": {
          "id": "ride-uuid",
          "status": "sending",
          "pickupLocation": { "latitude": 25.285, "longitude": 51.531, "address": "Doha Intl" },
          "dropoffLocation": { "latitude": 25.320, "longitude": 51.533, "address": "City Center" },
          "tariffId": "tariff-uuid",
          "fare": "0.00",
          "earningsSoFar": "0.00",
          "rider": { "id": "user-uuid", "name": "John Doe", "phoneNumber": "+974..." },
          "jobStatusLog": []
        }
      }
      ```
    - Frontend: maps via `createJobObject()`, stores job, shows toast, calls `PUT changeRideStatus(..., 'displayed')` to acknowledge.
  - **job_updated**
    - Payload example: `{ "event": "job_updated", "data": { "job": { ... } } }`
    - Frontend: merges job into store, updates screen.
  - **ride_cancelled**
    - Payload example: `{ "event": "ride_cancelled", "data": { "jobId": "ride-uuid" } }`
    - Frontend: clears job, stops timers, notifies driver.
  - **auth_error**
    - Payload example: `{ "message": "Token expired" }`
    - Frontend: stops WebSocket + background service, prompts re-login.
- Client → server follow-up messages (when triggered by UI):
  - `{ "type": "driver_status_change", "payload": { "newStatus": "available" } }`
  - `{ "type": "job_status_update", "payload": { "jobId": "...", "status": "started" } }`
  - `{ "type": "job_update", "data": { "job": { /* partial ride */ } } }`
  Backend should define responses/acknowledgements and mirror changes over REST/WebSocket so mobile state stays authoritative.

Location + Movement Tracking

- VehicleMovementTracker (src/utils/services/movementTracker.js)
  - Geolocation.watchPosition to update location store
  - Filters GPS noise using accuracy, speed, and jump detection
  - Movement states: STOPPED, NORMAL_SPEED, LITTLE_HIGH_SPEED, MORE_SPEED, TOO_HIGH_SPEED
  - Determines nextUpdateInterval based on state to drive background loop pacing
- Background service (src/BackgroundService.js)
  - Uses react-native-background-actions
  - startService(): checks BackgroundService.isRunning(), requests permissions, starts mainBackgroundTask
  - stopService(): stops background-actions and flags store
- mainBackgroundTask (movementTracker.js)
  - has an isTaskRunning lock to prevent double-run
  - Loop while service running and shiftStarted == 'true'
  - Calls tracker.startWatching(), reads latest location from store
  - Sends driverLocationChange() if speed > threshold
  - If a job is active, calls processCurrentJobState() to update pricing + timing and sleeps for suggested interval
  - Always sleeps 1000ms per loop to re-check service state

Job Processing + Pricing

- src/utils/services/jobProcessor.js
  - EnhancedJobTimer accumulates elapsed seconds, waiting seconds, and distance meters
  - initializeFromJob() supports restoring state from job object (distance, waiting, lastKnownCoordinate)
  - update(currentLocation) returns { distance, waiting, elapsed, isMoving }
  - processCurrentJobState() updates job fields in store and computes fare via calculateJobPricing()
  - Pricing uses selectedTarrif fields:
    - startingPrice (currency)
    - distanceRate (per-meter assumed)
    - timeRate (per-second assumed)
    - waitingRate (per-second assumed)
  - If backend uses per-km or per-minute units, align conversion accordingly (frontend currently assumes per-meter/second)

Sample Job Payload (sent in `PUT changeRideStatus` and `PUT updateDriverRealTime`)

```json
{
  "id": "ride-uuid",
  "driverId": "driver-uuid",
  "status": "started",
  "fare": "12.50",
  "earningsSoFar": "12.50",
  "distanceTravelled": 8.4,
  "coordinateHistory": [
    { "latitude": 25.285, "longitude": 51.531, "timestamp": "2025-09-30T10:12:00Z" },
    { "latitude": 25.291, "longitude": 51.532, "timestamp": "2025-09-30T10:14:30Z" }
  ],
  "pricingBreakdown": {
    "totalDistance": 8.4,
    "duration": 780,
    "waitingSeconds": 120,
    "distanceCost": 5.04,
    "durationCost": 6.24,
    "waitingCost": 1.22,
    "startingPrice": 2.50,
    "totalCost": "12.50"
  },
  "selectedTarrif": {
    "id": "tariff-uuid",
    "name": "Standard",
    "startingPrice": "2.50",
    "distanceRate": "0.60",
    "timeRate": "0.48",
    "waitingRate": "0.61"
  },
  "jobStatusLog": [
    { "status": "displayed", "createdBy": "driver-uuid", "timestamp": "2025-09-30T10:00:00Z" },
    { "status": "accepted", "createdBy": "driver-uuid", "timestamp": "2025-09-30T10:01:30Z" }
  ]
}
```

Backend should merge the supplied fields (do not overwrite unset properties with null) and append to jobStatusLog. Pricing numbers should be safely coerced to decimals.

End-to-End Flow

1. **Login** (`POST /driver/auth/login`)
   - Stores response `{ token, driverId, vehicle info }` in AsyncStorage (`DriverData`, `authToken`).
2. **Start shift** (`PUT /driver/auth/shiftActivity { shiftActivity: true }`)
   - Expects 200 from backend. App starts background service (debounced) and opens WebSocket.
3. **Receive job** (`job_assigned` event)
   - App maps data to UI, calls `PUT changeRideStatus(... 'displayed')`, updates driver queue.
4. **Accept and progress**
   - Each milestone triggers `PUT changeRideStatus` with job snapshot containing pricing metrics and coordinate history.
   - Backend should persist `jobStatusLog`, update ride fields, and broadcast `job_updated`.
5. **Pricing + telemetry**
   - When status is `started`, background task updates distance/time/waiting based on location store and writes them into job state.
   - If network errors occur, we plan to queue updates locally and retry.
6. **Finish ride**
   - `PUT changeRideStatus(... 'completed')` followed by `... 'finished'` (or admin admin intervention). Backend returns final totals; frontend resets timers.
7. **End shift**
   - `PUT /driver/auth/shiftActivity { shiftActivity: false }` and `DELETE /driver-vehicles/onboard/finish/...`. App stops background service and WebSocket.

Status Progression Reference

| Status            | Trigger (frontend)           | Backend expectation                                                  |
|-------------------|------------------------------|-----------------------------------------------------------------------|
| `sending`         | Dispatcher assigns job       | Emit `job_assigned`; driver not yet aware                            |
| `displayed`       | Driver app acknowledges      | After `PUT changeRideStatus ... 'displayed'`                         |
| `accepted`        | Driver confirms job          | Lock job to driver, broadcast `job_updated`                          |
| `on_the_way`      | Driver en route              | Keep job active                                                      |
| `arrived_ready`   | Driver near pickup           | Optional rider notification                                          |
| `arrived`         | Driver at pickup             | Wait for passenger                                                   |
| `started`         | Ride begins                  | Backend should store start timestamp, allow pricing updates          |
| `completed`       | Driver ends ride             | Calculate totals, allow admin to mark `finished`                     |
| `finished`        | Admin/dispatcher finalizes   | Terminal state; remove from active list                              |
| `cancelled` etc.  | Rider/admin cancels          | App clears state, backend records reason                             |

Known Issues & Mitigations

- **Background service double-start**
  - Cause: both Start Shift UI and WebSocket `onopen` triggered `startService` simultaneously, creating overlapping loops and inflated fare calculations.
  - Mitigation added: `src/BackgroundService.js` now debounces starts (2-second window) and guards with `__startInProgress`. Movement tracker also checks `await isServiceRunning()` each loop.
  - Backend action: ensure shiftActivity endpoints treat duplicate calls idempotently; confirm whether auto-start on WebSocket open is desired.
- **AsyncStorage import**
  - Fixed to `@react-native-async-storage/async-storage` (see `src/locationStorage.js`).
- **API client error handling**
  - Still pending central interceptor. Currently the catch block logs and returns `undefined`. Backend should return structured JSON errors `{ message, code }` to display meaningfully once interceptors are in place.
- **Environment configuration**
  - `API_BASE_URL`/`WS_BASE_URL` now sourced from `react-native-config` (`APP_ORIGIN`, `API_PATH`, `WS_PATH`). Share these values with backend deployments for consistency.
- **Reverse geocoding**
  - Frontend calls Nominatim directly; requirement is to set a custom User-Agent or proxy through backend.

Backend Contracts Needed

- **Authorization**
  - All protected REST endpoints require `Authorization: Bearer <token>`.
  - Tokens should include enough identifiers for backend queries. Proposal: structure driver tokens as `{ userId, driverId, role: 'driver' }` (currently only driverId is present).

- **Driver location updates**
  - Body expected: `{ latitude, longitude, accuracy, speed, heading, movementState }`.
  - Units: `speed` in km/h; backend currently stores as provided. Please confirm there is no server-side unit conversion.
  - Update frequency: background loop sends updates roughly every 1–3 seconds depending on movement state.

- **Job status updates (`changeRideStatus`)**
  - Endpoint: `PUT /api/rider/ride/changeRideStatus/:rideId/:driverId/:status`.
  - Body: job snapshot (see “Sample Job Payload”). Backend should merge fields, append to `jobStatusLog`, and emit corresponding WebSocket broadcasts.
  - If backend needs additional fields (e.g., `distanceRateUnit`), communicate so frontend includes them.

- **WebSocket payloads**
  - `job_assigned`: include IDs, pickup/dropoff coordinates + addresses, tariffId, rider info, and initial jobStatusLog entry.
  - `job_updated`: wrap updated ride object under `data.job` to keep consistency.
  - `ride_cancelled`: include jobId + optionally reason.
  - `driver_status_update`/`location_update`: backend already emits; ensure shape remains `{ driverId, driverStatus, currentLocation }` so frontend can extend UI.

- **Tariffs**
  - Clarify units for `distanceRate`, `timeRate`, `waitingRate`. Frontend currently treats them as per-meter and per-second.
  - If backend operates on per-km/per-minute, we should agree on conversion factor to avoid rounding errors.

- **Stripe**
  - Ensure responses include fields consumed by frontend: `clientSecret`, `paymentIntentId`, and any `requiresAction` flags. Errors should include `code` and `message` for driver feedback.

Testing

- Unit tests added (Jest):
  - __tests__/api.test.js: axios wrapper behavior
  - __tests__/constants.test.js: endpoint paths
  - Socket provider test stubbed; requires @testing-library/react-native to assert URL and initial messages
- Jest configured in jest.config.js:
  - watchman disabled
  - transformIgnorePatterns includes RN ESM packages
  - Uses babel-jest
- Planned additions:
  - Add React Native Testing Library to test Login/StartShift/AcceptJob flows with mocked stores and WebSocket.
  - Add Detox E2E suite (Android first) covering login → shift on → receive job → status changes → shift off.

Suggested Improvements

- Introduce axios instance with interceptors:
  - Request: attach Authorization from AsyncStorage token
  - Response: centralized 401 handling → logout
- Normalize tariff units with backend (per-km/per-minute vs per-meter/per-second)
- Stabilize background loop pacing:
  - Remove redundant sleeps; use only nextUpdateInterval, avoid extra fixed 1000ms unless needed
  - Ensure tracker.stopWatching() always runs on stopService
- Add retry backoff strategy for HTTP location updates when offline; buffer in AsyncStorage and flush when online
- Rename typos (e.g., DRIVER_LOCATION_UPDETE → DRIVER_LOCATION_UPDATE) and standardize naming (Tariff vs Tarrif)
- Add environment config via react-native-config (ORIGIN, API_PATH, WS_PATH)
- Debounce or batch toasts to improve UX; avoid repeated banners during reconnect

Next Steps (coordination with Backend_API_Guide)

1. **Align on environment variables**: set shared `ORIGIN`, `API_PATH`, `WS_PATH`; backend to update CORS + WebSocket allowed origins accordingly.
2. **Confirm payload shapes**: backend to review Sample Job Payload and WebSocket examples; update `docs/Backend_API_Guide.md` if changes are needed.
3. **Tariff units**: decide on per-meter vs per-km, per-second vs per-minute; apply consistent conversion on both sides.
4. **Error schema**: adopt a standard error response (e.g., `{ message, code, details? }`) so interceptors can surface friendly toasts.
5. **Testing sync**: use Postman collection in backend repo and Jest tests here to validate contract changes before release.
