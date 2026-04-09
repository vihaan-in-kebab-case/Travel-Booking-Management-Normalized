PROMPT If you see ORA-01031: insufficient privileges, ask for: GRANT CREATE TRIGGER TO your_username;
CREATE OR REPLACE TRIGGER trg_users_bi
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  :NEW.status := fn_default_status(:NEW.status, 'active');
END;
/

CREATE OR REPLACE TRIGGER trg_travel_mode_bi
BEFORE INSERT ON travel_mode
FOR EACH ROW
BEGIN
  IF :NEW.mode_id IS NULL THEN
    :NEW.mode_id := travel_mode_seq.NEXTVAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_operator_bi
BEFORE INSERT ON operator
FOR EACH ROW
BEGIN
  IF :NEW.operator_id IS NULL THEN
    :NEW.operator_id := operator_seq.NEXTVAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_location_bi
BEFORE INSERT ON location
FOR EACH ROW
BEGIN
  IF :NEW.location_id IS NULL THEN
    :NEW.location_id := location_seq.NEXTVAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_passenger_bi
BEFORE INSERT ON passenger
FOR EACH ROW
BEGIN
  IF :NEW.passenger_id IS NULL THEN
    :NEW.passenger_id := passenger_seq.NEXTVAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_vehicle_bi
BEFORE INSERT ON vehicle
FOR EACH ROW
BEGIN
  IF :NEW.vehicle_id IS NULL THEN
    :NEW.vehicle_id := vehicle_seq.NEXTVAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_vehicle_operator_chk
BEFORE INSERT OR UPDATE ON vehicle
FOR EACH ROW
DECLARE
  v_mode_id NUMBER;
BEGIN
  v_mode_id := fn_operator_mode(:NEW.operator_id);
  NULL;
END;
/

CREATE OR REPLACE TRIGGER trg_route_bi
BEFORE INSERT ON route
FOR EACH ROW
BEGIN
  IF :NEW.route_id IS NULL THEN
    :NEW.route_id := route_seq.NEXTVAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_route_chk
BEFORE INSERT OR UPDATE ON route
FOR EACH ROW
DECLARE
  v_mode_id NUMBER;
BEGIN
  IF :NEW.start_location_id = :NEW.end_location_id THEN
    RAISE_APPLICATION_ERROR(-20002, 'Origin and destination cannot be the same.');
  END IF;

  v_mode_id := fn_operator_mode(:NEW.operator_id);
  NULL;
END;
/

CREATE OR REPLACE TRIGGER trg_schedule_bi
BEFORE INSERT ON schedule
FOR EACH ROW
BEGIN
  IF :NEW.schedule_id IS NULL THEN
    :NEW.schedule_id := schedule_seq.NEXTVAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_schedule_chk
BEFORE INSERT OR UPDATE ON schedule
FOR EACH ROW
DECLARE
  v_vehicle_mode   NUMBER;
  v_route_mode     NUMBER;
  v_capacity       NUMBER;
  v_vehicle_status VARCHAR2(20);
BEGIN
  v_vehicle_mode   := fn_vehicle_mode(:NEW.vehicle_id);
  v_route_mode     := fn_route_mode(:NEW.route_id);
  v_capacity       := fn_vehicle_capacity(:NEW.vehicle_id);
  v_vehicle_status := fn_vehicle_status(:NEW.vehicle_id);

  IF v_vehicle_mode <> v_route_mode THEN
    RAISE_APPLICATION_ERROR(-20004, 'Schedule vehicle mode and route mode must match.');
  END IF;

  IF LOWER(v_vehicle_status) <> 'active' THEN
    RAISE_APPLICATION_ERROR(-20005, 'Only active vehicles can be scheduled.');
  END IF;

  IF :NEW.seats_remaining > v_capacity THEN
    RAISE_APPLICATION_ERROR(-20006, 'Seats remaining cannot exceed vehicle capacity.');
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_booking_bi
BEFORE INSERT ON booking
FOR EACH ROW
BEGIN
  IF :NEW.booking_id IS NULL THEN
    :NEW.booking_id := booking_seq.NEXTVAL;
  END IF;

  IF :NEW.booking_date IS NULL THEN
    :NEW.booking_date := SYSTIMESTAMP;
  END IF;

  :NEW.booking_status := fn_default_status(:NEW.booking_status, 'Confirmed');

  IF :NEW.pnr_number IS NULL THEN
    :NEW.pnr_number := fn_generate_pnr(:NEW.booking_id);
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_payment_bi
BEFORE INSERT ON payment
FOR EACH ROW
BEGIN
  IF :NEW.payment_id IS NULL THEN
    :NEW.payment_id := payment_seq.NEXTVAL;
  END IF;

  IF :NEW.payment_date IS NULL THEN
    :NEW.payment_date := TRUNC(SYSDATE);
  END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_cancellation_bi
BEFORE INSERT ON cancellation
FOR EACH ROW
BEGIN
  IF :NEW.cancellation_id IS NULL THEN
    :NEW.cancellation_id := cancellation_seq.NEXTVAL;
  END IF;

  IF :NEW.cancellation_date IS NULL THEN
    :NEW.cancellation_date := TRUNC(SYSDATE);
  END IF;
END;
/
