-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Auth lookups and registration
-- ─────────────────────────────────────────────────────────────────────────────
SELECT user_id, full_name, email, phone, password, role, status
FROM users
WHERE user_id = :user_id;

SELECT user_id, full_name, email, phone, password, role, status
FROM users
WHERE LOWER(email) = LOWER(:email);

INSERT INTO users (user_id, full_name, email, phone, password, role)
VALUES (:user_id, :full_name, :email, :phone, :password, :role);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Travel search core queries
-- BCNF change: route no longer stores mode_id — join through operator instead.
--              vehicle no longer stores mode_id or seat_fare.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.schedule_id,
  s.route_id,
  s.vehicle_id,
  s.departure_datetime,
  s.arrival_datetime,
  s.base_fare,
  s.seats_remaining,
  s.status              AS schedule_status,
  r.route_name,
  r.operator_id,
  r.start_location_id,
  r.end_location_id,
  o.mode_id,
  tm.mode_name,
  o.operator_name,
  v.vehicle_name,
  v.vehicle_number,
  v.total_seats
FROM schedule s
JOIN route        r  ON r.route_id    = s.route_id
JOIN operator     o  ON o.operator_id = r.operator_id   -- mode resolved via operator
JOIN travel_mode  tm ON tm.mode_id    = o.mode_id
JOIN vehicle      v  ON v.vehicle_id  = s.vehicle_id
WHERE s.status = 'active'
ORDER BY s.departure_datetime;

-- Route stop query (composite PK — no route_stop_id column)
SELECT route_id, location_id, stop_sequence, arrival_datetime, departure_datetime
FROM route_stop
WHERE route_id = :route_id
ORDER BY stop_sequence;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vehicle CRUD queries
-- BCNF change: mode_id and seat_fare removed from vehicle.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicle (vehicle_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (:vehicle_id, :operator_id, :vehicle_number, :vehicle_name, :total_seats, :status);

UPDATE vehicle
SET operator_id    = :operator_id,
    vehicle_number = :vehicle_number,
    vehicle_name   = :vehicle_name,
    total_seats    = :total_seats,
    status         = :status
WHERE vehicle_id = :vehicle_id;

-- Vehicle list with mode resolved via operator
SELECT
  v.vehicle_id,
  v.operator_id,
  o.operator_name,
  o.mode_id,
  tm.mode_name,
  v.vehicle_number,
  v.vehicle_name,
  v.total_seats,
  v.status
FROM vehicle v
JOIN operator    o  ON o.operator_id = v.operator_id
JOIN travel_mode tm ON tm.mode_id    = o.mode_id
ORDER BY v.vehicle_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Route CRUD queries
-- BCNF change: mode_id removed from route.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO route (route_id, route_name, operator_id, start_location_id, end_location_id)
VALUES (:route_id, :route_name, :operator_id, :origin, :destination);

UPDATE route
SET operator_id       = :operator_id,
    start_location_id = :origin,
    end_location_id   = :destination
WHERE route_id = :route_id;

-- Route list with mode resolved via operator
SELECT
  r.route_id,
  r.route_name,
  r.operator_id,
  o.operator_name,
  o.mode_id,
  tm.mode_name,
  r.start_location_id,
  r.end_location_id
FROM route r
JOIN operator    o  ON o.operator_id = r.operator_id
JOIN travel_mode tm ON tm.mode_id    = o.mode_id
ORDER BY r.route_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Route stop CRUD queries
-- BCNF change: composite PK (route_id, stop_sequence) — no surrogate route_stop_id.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO route_stop (route_id, location_id, stop_sequence, arrival_datetime, departure_datetime)
VALUES (
  :route_id,
  :location_id,
  :stop_sequence,
  TO_TIMESTAMP(:arrival_datetime,   'YYYY-MM-DD"T"HH24:MI'),
  TO_TIMESTAMP(:departure_datetime, 'YYYY-MM-DD"T"HH24:MI')
);

DELETE FROM route_stop WHERE route_id = :route_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Booking creation queries
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO booking (booking_id, user_id, schedule_id, boarding_location_id, dropping_location_id,
                     booking_date, pnr_number, total_amount, booking_status)
VALUES (:booking_id, :user_id, :schedule_id, :boarding_location_id, :dropping_location_id,
        SYSTIMESTAMP, :pnr_number, :total_amount, 'Confirmed');

-- Passenger INSERT — BCNF change: user_id removed from passenger table.
INSERT INTO passenger (passenger_id, passenger_name, age, gender, id_proof_type, id_proof_number)
VALUES (:passenger_id, :passenger_name, :age, :gender, :id_proof_type, :id_proof_number);

-- booking_passenger INSERT — BCNF change: composite PK (booking_id, passenger_id),
-- no surrogate booking_passenger_id column.
INSERT INTO booking_passenger (booking_id, passenger_id, seat_number, fare)
VALUES (:booking_id, :passenger_id, :seat_number, :fare);

INSERT INTO payment (payment_id, booking_id, payment_method, amount_paid, payment_status, transaction_ref)
VALUES (:payment_id, :booking_id, :payment_method, :amount_paid, :payment_status, :transaction_ref);

UPDATE schedule
SET seats_remaining = seats_remaining - :seat_count
WHERE schedule_id = :schedule_id
  AND seats_remaining >= :seat_count;

-- Booked seats lookup (unchanged structure)
SELECT bp.seat_number
FROM booking_passenger bp
JOIN booking b ON b.booking_id = bp.booking_id
WHERE b.schedule_id = :schedule_id
  AND LOWER(NVL(b.booking_status, 'confirmed')) <> 'cancelled';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Booking cancellation queries
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE booking
SET booking_status = 'Cancelled'
WHERE booking_id = :booking_id;

UPDATE schedule
SET seats_remaining = seats_remaining + :seat_count
WHERE schedule_id = :schedule_id;

UPDATE payment
SET payment_status = 'Refund Pending'
WHERE booking_id = :booking_id;

INSERT INTO cancellation (cancellation_id, booking_id, cancellation_date, refund_amount,
                          cancellation_reason, refund_status)
VALUES (:cancellation_id, :booking_id, TRUNC(SYSDATE), :refund_amount, :reason, 'Initiated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Admin resource queries
-- ─────────────────────────────────────────────────────────────────────────────

-- Operators (unchanged)
SELECT operator_id, operator_name, mode_id, contact_email, contact_phone
FROM operator
ORDER BY operator_id;

-- Locations (unchanged)
SELECT location_id, location_name, city, state, country, location_type
FROM location
ORDER BY location_id;

-- Vehicles — BCNF change: no mode_id or seat_fare on vehicle; mode via operator join
SELECT
  v.vehicle_id,
  v.operator_id,
  v.vehicle_number,
  v.vehicle_name,
  v.total_seats,
  v.status
FROM vehicle v
ORDER BY v.vehicle_id;

-- Routes — BCNF change: no mode_id on route; mode via operator join
SELECT route_id, route_name, operator_id, start_location_id, end_location_id
FROM route
ORDER BY route_id;

-- Route stops — BCNF change: no route_stop_id; composite PK
SELECT route_id, location_id, stop_sequence, arrival_datetime, departure_datetime
FROM route_stop
ORDER BY route_id, stop_sequence;

-- Schedules (unchanged)
SELECT schedule_id, route_id, vehicle_id, departure_datetime, arrival_datetime,
       base_fare, seats_remaining, status
FROM schedule
ORDER BY schedule_id;

-- Bookings (unchanged)
SELECT booking_id, user_id, schedule_id, boarding_location_id, dropping_location_id,
       booking_date, pnr_number, total_amount, booking_status
FROM booking
ORDER BY booking_id DESC;

-- Booking passengers — BCNF change: no booking_passenger_id; composite PK
SELECT booking_id, passenger_id, seat_number, fare
FROM booking_passenger
ORDER BY booking_id, passenger_id;

-- Passengers — BCNF change: no user_id column
SELECT passenger_id, passenger_name, age, gender, id_proof_type, id_proof_number
FROM passenger;

-- Payments (unchanged)
SELECT payment_id, booking_id, payment_date, payment_method, amount_paid,
       payment_status, transaction_ref
FROM payment
ORDER BY payment_id DESC;

-- Cancellations (unchanged)
SELECT cancellation_id, booking_id, cancellation_date, refund_amount,
       cancellation_reason, refund_status
FROM cancellation
ORDER BY cancellation_id DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8A. Admin booking cancel action
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE booking
SET booking_status = 'Cancelled'
WHERE booking_id = :booking_id;

UPDATE payment
SET payment_status = 'Refund Pending'
WHERE booking_id = :booking_id;

MERGE INTO cancellation c
USING (SELECT :booking_id AS booking_id FROM dual) src
   ON (c.booking_id = src.booking_id)
 WHEN MATCHED THEN
   UPDATE SET
     cancellation_date   = TRUNC(SYSDATE),
     refund_amount       = :refund_amount,
     cancellation_reason = :reason,
     refund_status       = 'Initiated'
 WHEN NOT MATCHED THEN
   INSERT (cancellation_id, booking_id, cancellation_date, refund_amount,
           cancellation_reason, refund_status)
   VALUES (:cancellation_id, :booking_id, TRUNC(SYSDATE), :refund_amount, :reason, 'Initiated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8B. Admin reimbursement update action
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE cancellation
SET refund_amount       = :refund_amount,
    refund_status       = :refund_status,
    cancellation_reason = :cancellation_reason
WHERE cancellation_id = :cancellation_id;

UPDATE payment
SET payment_status = CASE
  WHEN LOWER(:refund_status) = 'reimbursed' THEN 'Refunded'
  ELSE 'Refund Pending'
END
WHERE booking_id = :booking_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Cleanup / delete operations
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM booking_passenger WHERE booking_id = :booking_id;
DELETE FROM booking           WHERE booking_id = :booking_id;
DELETE FROM route_stop        WHERE route_id   = :route_id;
DELETE FROM schedule          WHERE route_id   = :route_id;
DELETE FROM route             WHERE route_id   = :route_id;
DELETE FROM vehicle           WHERE vehicle_id = :vehicle_id;
DELETE FROM location          WHERE location_id = :location_id;
DELETE FROM operator          WHERE operator_id = :operator_id;
