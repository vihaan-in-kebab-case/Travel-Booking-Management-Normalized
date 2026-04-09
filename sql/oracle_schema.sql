BEGIN EXECUTE IMMEDIATE 'DROP TABLE cancellation CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE payment CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE booking_passenger CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE booking CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE schedule CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE route_stop CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE route CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE vehicle CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE passenger CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE location CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE operator CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE travel_mode CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE users CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_vehicle_status'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_vehicle_capacity'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_vehicle_mode'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_route_mode'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_operator_mode'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_default_status'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_generate_pnr'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE travel_mode_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE operator_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE location_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE passenger_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE vehicle_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE route_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE route_stop_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE schedule_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE booking_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE booking_passenger_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE payment_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE cancellation_seq'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

CREATE TABLE users (
  user_id   VARCHAR2(30)  PRIMARY KEY,
  full_name VARCHAR2(120) NOT NULL,
  email     VARCHAR2(150) NOT NULL UNIQUE,
  phone     VARCHAR2(20)  NOT NULL UNIQUE,
  password  VARCHAR2(255) NOT NULL,
  role      VARCHAR2(20)  DEFAULT 'user'   NOT NULL CHECK (role   IN ('admin', 'user')),
  status    VARCHAR2(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE travel_mode (
  mode_id   NUMBER        PRIMARY KEY,
  mode_name VARCHAR2(40)  NOT NULL UNIQUE
);

CREATE TABLE operator (
  operator_id    NUMBER        PRIMARY KEY,
  operator_name  VARCHAR2(120) NOT NULL,
  mode_id        NUMBER        NOT NULL REFERENCES travel_mode(mode_id),
  contact_email  VARCHAR2(150) NOT NULL UNIQUE,
  contact_phone  VARCHAR2(20)  NOT NULL UNIQUE
);

CREATE TABLE location (
  location_id   NUMBER        PRIMARY KEY,
  location_name VARCHAR2(150) NOT NULL,
  city          VARCHAR2(80)  NOT NULL,
  state         VARCHAR2(80)  NOT NULL,
  country       VARCHAR2(80)  DEFAULT 'India' NOT NULL,
  location_type VARCHAR2(40)  NOT NULL
);

CREATE TABLE passenger (
  passenger_id    NUMBER        PRIMARY KEY,
  passenger_name  VARCHAR2(120) NOT NULL,
  age             NUMBER(3)     NOT NULL CHECK (age BETWEEN 1 AND 120),
  gender          VARCHAR2(20)  NOT NULL,
  id_proof_type   VARCHAR2(40)  NOT NULL,
  id_proof_number VARCHAR2(80)  NOT NULL,
  CONSTRAINT uq_passenger_id_proof UNIQUE (id_proof_number)
);
  
CREATE TABLE vehicle (
  vehicle_id     NUMBER        PRIMARY KEY,
  operator_id    NUMBER        NOT NULL REFERENCES operator(operator_id),
  vehicle_number VARCHAR2(30)  NOT NULL UNIQUE,
  vehicle_name   VARCHAR2(120) NOT NULL,
  total_seats    NUMBER        NOT NULL CHECK (total_seats > 0),
  status         VARCHAR2(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE route (
  route_id           NUMBER       PRIMARY KEY,
  route_name         VARCHAR2(80) NOT NULL UNIQUE,
  operator_id        NUMBER       NOT NULL REFERENCES operator(operator_id),
  start_location_id  NUMBER       NOT NULL REFERENCES location(location_id),
  end_location_id    NUMBER       NOT NULL REFERENCES location(location_id),
  CONSTRAINT chk_route_locations CHECK (start_location_id != end_location_id)
);

CREATE TABLE route_stop (
  route_id           NUMBER    NOT NULL REFERENCES route(route_id) ON DELETE CASCADE,
  stop_sequence      NUMBER    NOT NULL,
  location_id        NUMBER    NOT NULL REFERENCES location(location_id),
  arrival_datetime   TIMESTAMP,
  departure_datetime TIMESTAMP,
  CONSTRAINT pk_route_stop PRIMARY KEY (route_id, stop_sequence),
  CONSTRAINT uq_route_stop_loc CHECK (1=1),
  CONSTRAINT uq_route_loc UNIQUE (route_id, location_id),
  CONSTRAINT chk_route_stop_time CHECK (
    arrival_datetime IS NULL OR departure_datetime IS NULL
    OR arrival_datetime <= departure_datetime
  )
);

CREATE TABLE schedule (
  schedule_id        NUMBER        PRIMARY KEY,
  vehicle_id         NUMBER        NOT NULL REFERENCES vehicle(vehicle_id),
  route_id           NUMBER        NOT NULL REFERENCES route(route_id) ON DELETE CASCADE,
  departure_datetime TIMESTAMP     NOT NULL,
  arrival_datetime   TIMESTAMP     NOT NULL,
  base_fare          NUMBER(10, 2) DEFAULT 0 NOT NULL,
  seats_remaining    NUMBER        NOT NULL,
  status             VARCHAR2(20)  DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_seats_non_negative CHECK (seats_remaining >= 0),
  CONSTRAINT chk_schedule_time      CHECK (departure_datetime < arrival_datetime)
);

CREATE TABLE booking (
  booking_id          NUMBER        PRIMARY KEY,
  user_id             VARCHAR2(30)  NOT NULL REFERENCES users(user_id),
  schedule_id         NUMBER        NOT NULL REFERENCES schedule(schedule_id),
  boarding_location_id NUMBER       NOT NULL REFERENCES location(location_id),
  dropping_location_id NUMBER       NOT NULL REFERENCES location(location_id),
  booking_date        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  pnr_number          VARCHAR2(30)  NOT NULL UNIQUE,
  total_amount        NUMBER(10, 2) NOT NULL,
  booking_status      VARCHAR2(30)  DEFAULT 'Confirmed' NOT NULL
);

CREATE TABLE booking_passenger (
  booking_id   NUMBER        NOT NULL REFERENCES booking(booking_id) ON DELETE CASCADE,
  passenger_id NUMBER        NOT NULL REFERENCES passenger(passenger_id),
  seat_number  VARCHAR2(10)  NOT NULL,
  fare         NUMBER(10, 2) NOT NULL,
  CONSTRAINT pk_booking_passenger PRIMARY KEY (booking_id, passenger_id),
  CONSTRAINT uq_booking_seat UNIQUE (booking_id, seat_number)
);

CREATE TABLE payment (
  payment_id      NUMBER        PRIMARY KEY,
  booking_id      NUMBER        NOT NULL REFERENCES booking(booking_id) ON DELETE CASCADE,
  payment_date    DATE          DEFAULT TRUNC(SYSDATE) NOT NULL,
  payment_method  VARCHAR2(40)  NOT NULL,
  amount_paid     NUMBER(10, 2) NOT NULL,
  payment_status  VARCHAR2(30)  DEFAULT 'Paid' NOT NULL,
  transaction_ref VARCHAR2(50)  NOT NULL UNIQUE
);

CREATE TABLE cancellation (
  cancellation_id     NUMBER        PRIMARY KEY,
  booking_id          NUMBER        NOT NULL REFERENCES booking(booking_id) ON DELETE CASCADE,
  cancellation_date   DATE          DEFAULT TRUNC(SYSDATE) NOT NULL,
  refund_amount       NUMBER(10, 2) NOT NULL,
  cancellation_reason VARCHAR2(250),
  refund_status       VARCHAR2(30)  DEFAULT 'Initiated' NOT NULL,
  CONSTRAINT uq_cancellation_booking UNIQUE (booking_id)
);

CREATE SEQUENCE travel_mode_seq  START WITH 10   INCREMENT BY 1;
CREATE SEQUENCE operator_seq     START WITH 100  INCREMENT BY 1;
CREATE SEQUENCE location_seq     START WITH 100  INCREMENT BY 1;
CREATE SEQUENCE passenger_seq    START WITH 100  INCREMENT BY 1;
CREATE SEQUENCE vehicle_seq      START WITH 100  INCREMENT BY 1;
CREATE SEQUENCE route_seq        START WITH 100  INCREMENT BY 1;
CREATE SEQUENCE schedule_seq     START WITH 100  INCREMENT BY 1;
CREATE SEQUENCE booking_seq      START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE payment_seq      START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE cancellation_seq START WITH 1000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION fn_generate_pnr(p_booking_id NUMBER)
RETURN VARCHAR2 IS
BEGIN
  RETURN 'PNR' || TO_CHAR(p_booking_id) || TO_CHAR(SYSTIMESTAMP, 'FF4');
END;
/

CREATE OR REPLACE FUNCTION fn_default_status(
  p_status        IN VARCHAR2,
  p_default_value IN VARCHAR2
)
RETURN VARCHAR2 IS
BEGIN
  IF p_status IS NULL OR TRIM(p_status) IS NULL THEN
    RETURN p_default_value;
  END IF;
  RETURN TRIM(p_status);
END;
/

CREATE OR REPLACE FUNCTION fn_operator_mode(p_operator_id NUMBER)
RETURN NUMBER IS
  v_mode_id NUMBER;
BEGIN
  SELECT mode_id INTO v_mode_id
    FROM operator
   WHERE operator_id = p_operator_id;
  RETURN v_mode_id;
END;
/

CREATE OR REPLACE FUNCTION fn_route_mode(p_route_id NUMBER)
RETURN NUMBER IS
  v_mode_id NUMBER;
BEGIN
  SELECT o.mode_id INTO v_mode_id
    FROM route r
    JOIN operator o ON o.operator_id = r.operator_id
   WHERE r.route_id = p_route_id;
  RETURN v_mode_id;
END;
/

CREATE OR REPLACE FUNCTION fn_vehicle_mode(p_vehicle_id NUMBER)
RETURN NUMBER IS
  v_mode_id NUMBER;
BEGIN
  SELECT o.mode_id INTO v_mode_id
    FROM vehicle v
    JOIN operator o ON o.operator_id = v.operator_id
   WHERE v.vehicle_id = p_vehicle_id;
  RETURN v_mode_id;
END;
/

CREATE OR REPLACE FUNCTION fn_vehicle_capacity(p_vehicle_id NUMBER)
RETURN NUMBER IS
  v_capacity NUMBER;
BEGIN
  SELECT total_seats INTO v_capacity
    FROM vehicle
   WHERE vehicle_id = p_vehicle_id;
  RETURN v_capacity;
END;
/

CREATE OR REPLACE FUNCTION fn_vehicle_status(p_vehicle_id NUMBER)
RETURN VARCHAR2 IS
  v_status VARCHAR2(20);
BEGIN
  SELECT status INTO v_status
    FROM vehicle
   WHERE vehicle_id = p_vehicle_id;
  RETURN v_status;
END;
/

INSERT INTO travel_mode (mode_id, mode_name) VALUES (1, 'Train');
INSERT INTO travel_mode (mode_id, mode_name) VALUES (2, 'Bus');
INSERT INTO travel_mode (mode_id, mode_name) VALUES (3, 'Flight');

INSERT INTO users (user_id, full_name, email, phone, password, role, status)
VALUES ('A001', 'Admin Operator', 'admin@travelhub.com', '9000000001',
        '$2a$10$MxeXjjqfyN19S9bm7U2nPuZB.Xys72iGxMW9nxSlNl49hHzEPLEfq', 'admin', 'active');

INSERT INTO users (user_id, full_name, email, phone, password, role, status)
VALUES ('U002', 'Maya Kapoor', 'user@travelhub.com', '9000000002',
        '$2a$10$o0cCi5izfHTi7ZQ1tE9Rhek3rD/9X0npKEYw./7iNseNj4UgUyrVe', 'user', 'active');

INSERT INTO operator (operator_id, operator_name, mode_id, contact_email, contact_phone)
VALUES (1, 'Indian Railways',   1, 'ops@railways.com',  '8000000001');
INSERT INTO operator (operator_id, operator_name, mode_id, contact_email, contact_phone)
VALUES (2, 'InterCity Mobility', 2, 'ops@intercity.com', '8000000002');
INSERT INTO operator (operator_id, operator_name, mode_id, contact_email, contact_phone)
VALUES (3, 'SkyLink Airways',   3, 'ops@skylink.com',   '8000000003');

INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (1, 'New Delhi Junction',              'Delhi',     'Delhi',          'India', 'Railway Station');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (2, 'Mumbai Central',                  'Mumbai',    'Maharashtra',    'India', 'Railway Station');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (3, 'Bengaluru Bus Terminal',          'Bengaluru', 'Karnataka',      'India', 'Bus Stand');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (4, 'Chennai Mofussil Bus Terminus',   'Chennai',   'Tamil Nadu',     'India', 'Bus Stand');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (5, 'Rajiv Gandhi International Airport', 'Hyderabad', 'Telangana',  'India', 'Airport');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (6, 'Goa International Airport',       'Goa',       'Goa',            'India', 'Airport');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (7, 'Kota Junction',                   'Kota',      'Rajasthan',      'India', 'Railway Station');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (8, 'Vadodara Junction',               'Vadodara',  'Gujarat',        'India', 'Railway Station');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (9, 'Surat Junction',                  'Surat',     'Gujarat',        'India', 'Railway Station');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (10, 'Krishnagiri Stop',               'Krishnagiri', 'Tamil Nadu',   'India', 'Bus Stand');
INSERT INTO location (location_id, location_name, city, state, country, location_type)
VALUES (11, 'Vellore Stop',                   'Vellore',   'Tamil Nadu',     'India', 'Bus Stand');

INSERT INTO vehicle (vehicle_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (1, 1, 'TR-11', 'Rajdhani Express', 12, 'active');
INSERT INTO vehicle (vehicle_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (2, 2, 'BS-08', 'InterCity Volvo',  12, 'active');
INSERT INTO vehicle (vehicle_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
VALUES (3, 3, 'FL-22', 'SkyLink Airways',  16, 'active');

INSERT INTO route (route_id, route_name, operator_id, start_location_id, end_location_id)
VALUES (1, 'NDLS-BCT', 1, 1, 2);
INSERT INTO route (route_id, route_name, operator_id, start_location_id, end_location_id)
VALUES (2, 'BLR-MAA',  2, 3, 4);
INSERT INTO route (route_id, route_name, operator_id, start_location_id, end_location_id)
VALUES (3, 'HYD-GOI',  3, 5, 6);

INSERT INTO route_stop (route_id, stop_sequence, location_id, arrival_datetime, departure_datetime)
VALUES (1, 1, 7,  TIMESTAMP '2026-04-10 10:30:00', TIMESTAMP '2026-04-10 10:45:00');
INSERT INTO route_stop (route_id, stop_sequence, location_id, arrival_datetime, departure_datetime)
VALUES (1, 2, 8,  TIMESTAMP '2026-04-10 14:30:00', TIMESTAMP '2026-04-10 14:45:00');
INSERT INTO route_stop (route_id, stop_sequence, location_id, arrival_datetime, departure_datetime)
VALUES (1, 3, 9,  TIMESTAMP '2026-04-10 16:45:00', TIMESTAMP '2026-04-10 16:55:00');
INSERT INTO route_stop (route_id, stop_sequence, location_id, arrival_datetime, departure_datetime)
VALUES (2, 1, 10, TIMESTAMP '2026-04-12 00:00:00', TIMESTAMP '2026-04-12 00:10:00');
INSERT INTO route_stop (route_id, stop_sequence, location_id, arrival_datetime, departure_datetime)
VALUES (2, 2, 11, TIMESTAMP '2026-04-12 02:00:00', TIMESTAMP '2026-04-12 02:10:00');

INSERT INTO schedule (schedule_id, vehicle_id, route_id, departure_datetime, arrival_datetime, base_fare, seats_remaining, status)
VALUES (1, 1, 1, TIMESTAMP '2026-04-10 06:30:00', TIMESTAMP '2026-04-10 18:15:00', 120,  12, 'active');
INSERT INTO schedule (schedule_id, vehicle_id, route_id, departure_datetime, arrival_datetime, base_fare, seats_remaining, status)
VALUES (2, 2, 2, TIMESTAMP '2026-04-11 21:00:00', TIMESTAMP '2026-04-12 05:30:00', 55,   12, 'active');
INSERT INTO schedule (schedule_id, vehicle_id, route_id, departure_datetime, arrival_datetime, base_fare, seats_remaining, status)
VALUES (3, 3, 3, TIMESTAMP '2026-04-12 14:10:00', TIMESTAMP '2026-04-12 15:30:00', 185,  16, 'active');
COMMIT;
