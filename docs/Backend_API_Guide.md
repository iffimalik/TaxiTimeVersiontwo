Backend Integration Guide

Overview

TaxiTime backend is an Express + Sequelize API with JWT auth and WebSocket realtime updates. All REST endpoints are mounted under /api. WebSocket connects via /realtime and broadcasts ride and driver events to connected clients.

Base URL

- Local default: http://localhost:3000/api
- WebSocket: ws://localhost:3000/realtime?token=JWT

Quickstart

- Install deps: npm i
- Configure env in .env or config/config.js (see Environment Variables below)
- Run: node server.js
- Health check: GET /serverstatus → { status: 'running', timestamp }

Auth

- Bearer token in Authorization header: Authorization: Bearer <JWT>
- Token payload varies by role:
  - Rider: { id: <userId>, role: 'rider' }
  - Admin/Dispatcher: { id: <userId>, role: 'admin' | 'dispatcher' }
  - Driver: { id: <driverId>, role: 'driver' }  // note: driver.id not user.id

Important: auth middleware currently resolves users differently by role:
- Admin/Dispatcher: loads Users by decoded.id
- Driver: loads Driver by decoded.id, then the related User as req.user (with .Driver included)
- Rider: ensure the rider token is accepted for protected endpoints; if any issue arises, we can extend middleware to explicitly allow role 'rider'.

Common Headers

- Content-Type: application/json
- Authorization: Bearer <token> for protected routes

Key Enums

- Ride.status: 'pending','sending','displayed','accepted','rejected','on_the_way','arrived_ready','arrived','started','completed','finished','cancelled','paused','noShow','recalled'
- Driver.driverStatus: 'available','away','onRide','offline','suspended'
- Vehicle.rideType: 'hireable','hailable'
- Vehicle.vehicleClass: 'economy','business','vip','normal'
- Payment.method: 'cash','card','wallet'

Data Units & Conventions

- Distances
  - Frontend sends distanceTravelled in meters; backend stores distance in kilometers. Conversion is applied during changeRideStatus.
- Speed
  - Driver location uses km/h (matches frontend tracker).
- Money
  - Most endpoints accept/display currency in unit currency (e.g., NZD dollars), not minor units. Stripe uses minor units internally.
- Time
  - ISO 8601 strings in UTC unless noted (pickupTime, dropoffTime, timestamps in jobStatusLog).

Auth Endpoints

- Rider
  - POST /rider/auth/register
    - body: { name, email, password, phone }
    - 201 -> { message, userId }
  - POST /rider/auth/login
    - body: { email, password }
    - 200 -> { message, token }
  - GET /rider/auth/profile (Bearer)
    - 200 -> user object

- Driver
  - POST /driver/auth/register
    - body: { name, email, password, phone, licenseNumber?, licenseExpiryDate? ... }
    - 201 -> driver + user fields + token
  - POST /driver/auth/login
    - body: { email, password }
    - 200 -> { ack: 1, message, token, ...driverObject }
  - GET /driver/auth/profile (Bearer)
  - PUT /driver/auth/profile (Bearer)

- Admin/Dispatcher
  - POST /admin/auth/register
    - body: { name, email, password }
  - POST /admin/auth/login
    - body: { email, password }
    - 200 -> { data: { token, userObject } }
  - GET /admin/auth/profile (Bearer)

Driver Actions

- PUT /driver/auth/location (Bearer driver)
  - body: { latitude, longitude, accuracy, speed, heading, timestamp, movementState }
- PUT /driver/auth/availability (Bearer driver)
  - body: { available: boolean }
- PUT /driver/auth/shiftActivity (Bearer driver)
  - body: { shiftActivity: boolean } // start/stop shift
- PUT /driver/auth/driver-status-change (Bearer driver)
  - body: { status: 'available' | 'away' | 'onRide' | 'offline' | 'suspended' }
- POST /driver/auth/accepted-ride (Bearer driver)
  - body: { date?, limit?, offset? }
- POST /driver/auth/completed-rides (Bearer driver)
  - list last 5 completed today

Rides

- POST /rider/ride/request (Bearer rider)
  - body: {
      pickupLocation: { latitude, longitude, address? },
      dropoffLocation?: { latitude, longitude, address? },
      tariffId?, passengerCount?, bagCount?, wheelchairCount?, wheelchairAccessNeeded?, towingOption?,
      notes?, pickupTime?, dropoffTime?, vehicleTypeId?, RideType?, paymentMethod ('cash'|'card'|'wallet'), fare?, riderId?, earningsSoFar?
    }
  - 201 -> { message, ride }

- Assignment & Status
  - PUT /rider/ride/assignJobToDriver/:rideId/:driverId/:status (Bearer admin/dispatcher)
    - status commonly 'sending' | 'displayed'
- PUT /rider/ride/changeRideStatus/:rideId/:driverId/:status (Bearer)
    - status progression: accepted → on_the_way → arrived_ready → arrived → started → completed → finished
    - Supports idempotent retries: include header `x-idempotency-key: <uuid>` (or body.idempotencyKey). Duplicate requests with the same key are acknowledged without reapplying changes.
    - Body (optional): { coordinateHistory, distanceTravelled (meters), fare (number), earningsSoFar (number) }
    - Backend normalizes distanceTravelled (m) → distance (km) and persists numeric fare/earningsSoFar if sent.

- Lists & Queries
  - GET /rider/ride/getAllDriverActiveRides?status=pending,accepted,started,... (Bearer)
  - GET /rider/ride/pending-rides (Bearer)
  - GET /rider/ride/my-rides (Bearer rider)
  - GET /rider/ride/getDriverRealTime/:driverId (Bearer)
  - PUT /rider/ride/updateDriverRealTime/:driverId/:jobId (Bearer)
  - GET /rider/ride/getDriverActiveRide/:driverId (Bearer)
  - GET /rider/ride/getLastThreeRide/:driverId (Bearer)
  - GET /rider/ride/todaystates/:driverId (Bearer driver)
  - GET /rider/ride/AllJobStatusCount (Bearer)

- Admin overrides
  - PUT /rider/ride/cancelJob/:rideId (Bearer admin)
  - PUT /rider/ride/jobtake/:rideId (Bearer admin) // revert to pending

- Cancel (rider)
  - PUT /rider/ride/:rideId/cancel (Bearer rider)

Payments (Stripe)

- POST /rider/ride/create-payment-intent (Bearer rider)
  - body: { amount, currency?, riderId? }
- POST /rider/ride/create-nfc-payment-intent (Bearer rider)
  - body: { amount, currency, rideId, cardUid }
- POST /rider/ride/scan-create-payment-intent (Bearer rider)
  - body: { paymentMethodId, amount, currency?, rideId }
- Note: uses Stripe test key in code; should be set via env in production.

Vehicles

- Vehicle Types: /vehicle-type (REST)
  - POST /vehicle-type/
  - GET /vehicle-type/
  - GET /vehicle-type/:id
  - PUT /vehicle-type/:id
  - DELETE /vehicle-type/:id

- Vehicles: /vehicles
  - POST /vehicles/create_vehicle
  - GET /vehicles/get_vehicle_list
  - GET /vehicles/get_vehicle/:id
  - PUT /vehicles/update_vehicle/:id
  - DELETE /vehicles/delete_vehicle/:id

- Driver-Vehicle assignments: /driver-vehicles
  - POST /driver-vehicles/assign
  - GET /driver-vehicles/driver/:driverId/vehicles
  - GET /driver-vehicles/vehicle/:vehicleId/drivers
  - DELETE /driver-vehicles/unassign/driver/:driverId/vehicle/:vehicleId
  - POST /driver-vehicles/onboard (Bearer)
  - GET /driver-vehicles/onboard/driver/:driverId
  - GET /driver-vehicles/onboard/vehicle/:vehicleId
  - DELETE /driver-vehicles/onboard/finish/driver/:driverId/vehicle/:vehicleId

Zones & Tariffs

- Zones: /admin/zones
  - POST /admin/zones/createZone
  - GET /admin/zones/getAll
  - GET /admin/zones/getSingleZone/:id
  - PUT /admin/zones/updateZone/:id
  - DELETE /admin/zones/deleteZone/:id
  - POST /admin/zones/detect { lat, lng }

- Tariffs: /tariffs (REST)
  - POST /tariffs/
  - GET /tariffs/
  - GET /tariffs/:id
  - PUT /tariffs/:id
  - DELETE /tariffs/:id

Realtime (WebSocket)

- Connect: ws://<host>/realtime?token=<JWT>
- On connect: server sends { event: 'connected', data: { message, user } }
- Outgoing broadcast events (examples):
  - job_assigned: data is full ride object (after assignment at 'sending' state)
  - job_taken: { rideId, driverId }
  - ride_updated: { rideId, status, driverId, updatedAt }
  - job_updated: <full ride object> emitted on status changes for easy UI refresh
  - ride_cancelled: { rideId }
  - driver_status_update: { driverId, driverStatus, currentLocation, previousStatus }
  - location_update: { driverId, driverStatus, currentLocation, previousStatus }
- Incoming messages supported:
  - driver_status_change: { payload: { newStatus } }
  - job_status_update: { payload: { jobId, status } }
  - job_update: { data: { job: { id, tariffId, ... } } } // persists partial jobData

Event Samples

- job_assigned
  {
    "event": "job_assigned",
    "data": {
      "id": "ride-uuid",
      "status": "sending",
      "pickupLocation": { "id":"..","latitude":25.28,"longitude":51.53,"address":".." },
      "dropoffLocation": { "id":"..","latitude":25.29,"longitude":51.54,"address":".." },
      "tarrif": { "id":"..","name":"Default","startingPrice":5, "distanceRate":1.5, "timeRate":0.5 },
      "rider": { "id":"user-uuid","name":".." },
      "driverId": "driver-uuid",
      "fare": 0,
      "earningsSoFar": 0
    }
  }

- job_updated (on status change)
  { "event":"job_updated", "data": { /* full ride object as above, with updated status */ } }

- ride_updated (lightweight)
  { "event":"ride_updated", "data": { "rideId":"ride-uuid", "status":"arrived", "driverId":"driver-uuid", "updatedAt":"ISO" } }

- ride_cancelled
  { "event":"ride_cancelled", "data": { "rideId":"ride-uuid" } }

- driver_status_update (from driver model hooks)
  { "event":"driver_status_update", "data": { "driverId":"driver-uuid", "driverStatus":"available", "currentLocation":"{...}", "previousStatus":"offline" } }

Notes on driverId semantics

- WebSocket delivery to drivers uses token.id (driver.id) as the recipient key. For reliability, events should always include driver.id. If an event carries userId instead, drivers may not receive unicast messages; we are aligning all events to driverId. Frontend can temporarily tolerate either by checking both data.driverId and data.userId.
- Incoming messages supported:
  - driver_status_change: { payload: { newStatus } }
  - job_status_update: { payload: { jobId, status } }
  - job_update: { data: { job: { id, tariffId, ... } } } // persists partial jobData

Errors

- 401 Unauthorized: invalid or missing token
- 400 Bad Request: validation errors
- 404 Not Found: resource missing
- 409 Conflict: unique constraints
- 500 Internal Server Error

Environment Variables

- JWT_SECRET (required)
- DB config via config/config.js (Sequelize)
- STRIPE_SECRET (recommended; move hardcoded test key to env)
- FRONTEND_URL (CORS)

Developer Tooling

- Postman: import postman/TaxiTime_API.postman_collection.json and postman/TaxiTime_Local.postman_environment.json
- Tests: npm test (Jest + Supertest). Skips real DB in NODE_ENV=test.
- WebSocket testing: connect with a role-appropriate token; observe events on role=driver/admin/dispatcher clients.

Notes & Gaps

- Auth middleware distinction by role means driver tokens embed driver.id. Keep this in mind when generating mobile tokens.
- If rider-protected routes return 401, we will extend middleware to handle role 'rider' explicitly.
- Stripe endpoints require network + valid keys; isolate for dev.

Status Lifecycle (Reference)

- Unassigned: pending, displayed
- Assigned (pre-arrival): accepted, on_the_way
- Arrival: arrived_ready, arrived
- Active: started
- Completion: completed, finished
- Terminal: cancelled, rejected, recalled, noShow

Status Update Examples

- Accept job
  PUT /api/rider/ride/changeRideStatus/{rideId}/{driverId}/accepted
  Headers: { Authorization: Bearer <token>, x-idempotency-key: <uuid> }
  Body: { }

- Driver en‑route
  PUT /api/rider/ride/changeRideStatus/{rideId}/{driverId}/on_the_way
  Headers: { Authorization, x-idempotency-key }
  Body: { coordinateHistory:[{ lat, lng, ts }], distanceTravelled: 1234 }

- Complete job with fare
  PUT /api/rider/ride/changeRideStatus/{rideId}/{driverId}/completed
  Body: { fare: 32.5, earningsSoFar: 32.5, distanceTravelled: 5320 }

Sample Login Responses

- Rider login
  { "message":"Login successful", "token":"..." }

- Driver login
  { "ack":1, "message":"Login successful", "token":"...", "driverObject": { /* fields */ } }

Change Log

- 2025‑09‑30
  - changeRideStatus: idempotency support via x-idempotency-key
  - changeRideStatus: distance normalization (m → km), emits additional job_updated and ride_cancelled events
  - Realtime: documented new event samples
