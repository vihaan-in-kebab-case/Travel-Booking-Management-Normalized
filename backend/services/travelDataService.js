const crypto = require("crypto");
const {
  execute,
  normalizeRows,
  withConnection,
  withTransaction,
  oracledb
} = require("../config/db");

function normalizeStatus(value, allowedValues, fallback) {
  const normalized = String(value || fallback || "").trim().toLowerCase();
  if (!allowedValues.includes(normalized)) {
    throw new Error(`Status must be one of: ${allowedValues.join(", ")}.`);
  }

  return normalized;
}

function byId(collection, key, value) {
  return collection.find((item) => String(item[key]) === String(value));
}

function toDatePart(dateTime) {
  const parsed = dateTime ? new Date(dateTime) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function toTimePart(dateTime) {
  const parsed = dateTime ? new Date(dateTime) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function toDateTimeInput(dateTime) {
  return dateTime ? `${toDatePart(dateTime)}T${toTimePart(dateTime)}` : "";
}

function unwrapOutBind(value) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPnr(bookingId) {
  return `PNR${bookingId}${crypto.randomUUID().toString().slice(0, 4).toUpperCase()}`;
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
}

const LOCATION_TYPES_BY_MODE = {
  train: ["railway station"],
  bus: ["bus stand"],
  flight: ["airport"]
};

function getModeTypeName(modeValue, tables) {
  const normalized = String(modeValue || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (LOCATION_TYPES_BY_MODE[normalized]) {
    return normalized;
  }

  const matchedMode = tables?.modes?.find((mode) => String(mode.mode_id) === String(modeValue));
  return String(matchedMode?.mode_name || "").trim().toLowerCase();
}

function getLocationModeTypes(location) {
  const normalizedType = String(location?.location_type || "").trim().toLowerCase();
  return Object.entries(LOCATION_TYPES_BY_MODE)
    .filter(([, locationTypes]) => locationTypes.includes(normalizedType))
    .map(([modeType]) => modeType);
}

function isLocationAllowedForMode(location, modeValue, tables) {
  const modeType = getModeTypeName(modeValue, tables);
  if (!modeType) {
    return true;
  }

  const allowedTypes = LOCATION_TYPES_BY_MODE[modeType] || [];
  return allowedTypes.includes(String(location?.location_type || "").trim().toLowerCase());
}

function buildLocationOption(location) {
  return {
    value: String(location.location_id),
    label: `${location.location_name} - ${location.city}`,
    location_type: location.location_type,
    mode_types: getLocationModeTypes(location)
  };
}

function buildSeatMap(totalSeats) {
  const seats = [];
  const safeSeats = Number(totalSeats) || 0;

  for (let index = 0; index < safeSeats; index += 1) {
    const row = String.fromCharCode(65 + Math.floor(index / 4));
    const number = (index % 4) + 1;
    seats.push(`${row}${number}`);
  }

  const rows = [];
  for (let index = 0; index < seats.length; index += 4) {
    rows.push(seats.slice(index, index + 4));
  }

  return rows;
}

function flattenSeatMap(seatMap) {
  return Array.isArray(seatMap) ? seatMap.flatMap((row) => (Array.isArray(row) ? row : [])) : [];
}

function assignSeats({ totalSeats, bookedSeats, requestedSeatCount }) {
  const seatPool = flattenSeatMap(buildSeatMap(totalSeats));
  const unavailableSeats = new Set((bookedSeats || []).map((seat) => String(seat || "").trim()).filter(Boolean));
  const assignedSeats = seatPool.filter((seat) => !unavailableSeats.has(seat)).slice(0, requestedSeatCount);

  if (assignedSeats.length !== requestedSeatCount) {
    throw new Error("Not enough seats available for this travel.");
  }

  return assignedSeats;
}

function getBookedSeatsForSchedule(scheduleId, tables) {
  const activeBookingIds = tables.bookings
    .filter((booking) => String(booking.schedule_id) === String(scheduleId) && String(booking.booking_status).toLowerCase() !== "cancelled")
    .map((booking) => booking.booking_id);

  return tables.bookingPassengers
    .filter((item) => activeBookingIds.includes(item.booking_id))
    .map((item) => String(item.seat_number || "").trim())
    .filter(Boolean);
}

function locationMatches(location, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (String(location.location_id) === String(query)) {
    return true;
  }

  return [location.location_name, location.city]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function shiftDateTime(dateTime, offsetMs = 0) {
  const parsed = dateTime ? new Date(dateTime) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getTime() + offsetMs);
}

function buildShiftedSchedule(schedule, offsetMs = 0) {
  return {
    ...schedule,
    departure_datetime: shiftDateTime(schedule?.departure_datetime, offsetMs),
    arrival_datetime: shiftDateTime(schedule?.arrival_datetime, offsetMs)
  };
}

function getRoutePath(route, tables, schedule, offsetMs = 0) {
  const shiftedSchedule = buildShiftedSchedule(schedule, offsetMs);
  const start = byId(tables.locations, "location_id", route?.start_location_id);
  const end = byId(tables.locations, "location_id", route?.end_location_id);
  const stops = tables.routeStops
    .filter((stop) => String(stop.route_id) === String(route?.route_id))
    .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
    .map((stop) => {
      const location = byId(tables.locations, "location_id", stop.location_id);
      const shiftedArrival = shiftDateTime(stop.arrival_datetime, offsetMs);
      const shiftedDeparture = shiftDateTime(stop.departure_datetime, offsetMs);
      return {
        location_id: stop.location_id,
        location_name: location?.location_name || "",
        city: location?.city || "",
        arrival_datetime: shiftedArrival,
        departure_datetime: shiftedDeparture,
        arrival_time: toTimePart(shiftedArrival),
        departure_time: toTimePart(shiftedDeparture),
        isStop: true
      };
    });

  return [
    {
      location_id: route?.start_location_id,
      location_name: start?.location_name || "",
      city: start?.city || "",
      arrival_datetime: null,
      departure_datetime: shiftedSchedule?.departure_datetime || null,
      arrival_time: "",
      departure_time: shiftedSchedule ? toTimePart(shiftedSchedule.departure_datetime) : "",
      isStop: false
    },
    ...stops,
    {
      location_id: route?.end_location_id,
      location_name: end?.location_name || "",
      city: end?.city || "",
      arrival_datetime: shiftedSchedule?.arrival_datetime || null,
      departure_datetime: null,
      arrival_time: shiftedSchedule ? toTimePart(shiftedSchedule.arrival_datetime) : "",
      departure_time: "",
      isStop: false
    }
  ];
}

function findLeg(route, schedule, tables, filters, offsetMs = 0) {
  const path = getRoutePath(route, tables, schedule, offsetMs);
  const originIndex = filters.origin ? path.findIndex((location) => locationMatches(location, filters.origin)) : 0;
  const destinationIndex = filters.destination ? path.findIndex((location) => locationMatches(location, filters.destination)) : path.length - 1;

  if (originIndex === -1 || destinationIndex === -1 || originIndex >= destinationIndex) {
    return null;
  }

  return {
    origin: path[originIndex],
    destination: path[destinationIndex],
    amenities: path.slice(originIndex + 1, destinationIndex).map((location) => location.city || location.location_name)
  };
}

function buildTravelView(schedule, tables, overrides = {}, offsetMs = 0) {
  const shiftedSchedule = buildShiftedSchedule(schedule, offsetMs);
  const route = byId(tables.routes, "route_id", schedule.route_id);
  const vehicle = byId(tables.vehicles, "vehicle_id", schedule.vehicle_id);
  const operator = byId(tables.operators, "operator_id", route?.operator_id);
  const mode = byId(tables.modes, "mode_id", operator?.mode_id);
  const start = byId(tables.locations, "location_id", route?.start_location_id);
  const end = byId(tables.locations, "location_id", route?.end_location_id);
  const routePath = getRoutePath(route, tables, schedule, offsetMs);
  const routeStops = routePath.filter((point) => point.isStop);
  const unavailableSeats = getBookedSeatsForSchedule(schedule.schedule_id, tables);

  return {
    id: schedule.schedule_id,
    schedule_id: schedule.schedule_id,
    route_id: route?.route_id,
    vehicle_id: vehicle?.vehicle_id,
    type: String(mode?.mode_name || "travel").toLowerCase(),
    name: vehicle?.vehicle_name || route?.route_name,
    operatorName: operator?.operator_name || "",
    origin: overrides.origin || start?.city || "",
    destination: overrides.destination || end?.city || "",
    originLocationId: overrides.originLocationId ?? route?.start_location_id,
    destinationLocationId: overrides.destinationLocationId ?? route?.end_location_id,
    departureDate: overrides.departureDate || toDatePart(shiftedSchedule.departure_datetime),
    arrivalDate: overrides.arrivalDate || toDatePart(shiftedSchedule.arrival_datetime),
    departureTime: overrides.departureTime || toTimePart(shiftedSchedule.departure_datetime),
    arrivalTime: overrides.arrivalTime || toTimePart(shiftedSchedule.arrival_datetime),
    departureDateTime: overrides.departureDateTime || toDateTimeInput(shiftedSchedule.departure_datetime),
    arrivalDateTime: overrides.arrivalDateTime || toDateTimeInput(shiftedSchedule.arrival_datetime),
    price: Number(schedule.base_fare || 0),
    seatsAvailable: Number(schedule.seats_remaining || 0),
    vehicleCode: vehicle?.vehicle_number,
    routeCode: route?.route_name,
    amenities: overrides.amenities || (routeStops.length ? routeStops.map((stop) => stop.city || stop.location_name) : [mode?.mode_name || "travel"]),
    intermediateStops: routeStops.map((stop) => ({
      location_id: stop.location_id,
      location_name: stop.location_name,
      city: stop.city,
      arrivalDateTime: stop.arrival_datetime ? toDateTimeInput(stop.arrival_datetime) : "",
      departureDateTime: stop.departure_datetime ? toDateTimeInput(stop.departure_datetime) : ""
    })),
    seatMap: buildSeatMap(vehicle?.total_seats),
    unavailableSeats,
    status: schedule.status
  };
}

function buildBookingView(booking, tables) {
  const bookingUser = byId(tables.users, "user_id", booking.user_id);
  const schedule = byId(tables.schedules, "schedule_id", booking.schedule_id);
  const route = schedule ? byId(tables.routes, "route_id", schedule.route_id) : null;
  const routePath = route && schedule ? getRoutePath(route, tables, schedule) : [];
  let filteredRoutePath = routePath;
  if (routePath.length) {
    const boardingIndex = routePath.findIndex((point) => String(point.location_id) === String(booking.boarding_location_id));
    const droppingIndex = routePath.findIndex((point) => String(point.location_id) === String(booking.dropping_location_id));
    if (boardingIndex !== -1 && droppingIndex !== -1 && boardingIndex < droppingIndex) {
      filteredRoutePath = routePath.slice(boardingIndex + 1, droppingIndex);
    }
  }
  const boardingPoint = byId(filteredRoutePath,"location_id", booking.boarding_location_id);
  const droppingPoint = byId(filteredRoutePath, "location_id", booking.dropping_location_id);
  const travel = schedule
    ? buildTravelView(schedule, tables, {
        originLocationId: booking.boarding_location_id,
        destinationLocationId: booking.dropping_location_id,
        origin: byId(tables.locations, "location_id", booking.boarding_location_id)?.city || "",
        destination: byId(tables.locations, "location_id", booking.dropping_location_id)?.city || "",
        departureDate: boardingPoint?.departure_datetime ? toDatePart(boardingPoint.departure_datetime) : toDatePart(schedule.departure_datetime),
        arrivalDate: droppingPoint?.arrival_datetime ? toDatePart(droppingPoint.arrival_datetime) : toDatePart(schedule.arrival_datetime),
        departureTime: boardingPoint?.departure_datetime ? toTimePart(boardingPoint.departure_datetime) : toTimePart(schedule.departure_datetime),
        arrivalTime: droppingPoint?.arrival_datetime ? toTimePart(droppingPoint.arrival_datetime) : toTimePart(schedule.arrival_datetime),
        departureDateTime: boardingPoint?.departure_datetime ? toDateTimeInput(boardingPoint.departure_datetime) : toDateTimeInput(schedule.departure_datetime),
        arrivalDateTime: droppingPoint?.arrival_datetime ? toDateTimeInput(droppingPoint.arrival_datetime) : toDateTimeInput(schedule.arrival_datetime)
      })
    : null;
  if (travel) {
      travel.intermediateStops = filteredRoutePath.filter((point) => point.isStop).map((stop) => ({
        location_id: stop.location_id,
        location_name: stop.location_name,
        city: stop.city,
        arrivalDateTime: stop.arrival_datetime ? toDateTimeInput(stop.arrival_datetime) : "",
        departureDateTime: stop.departure_datetime ? toDateTimeInput(stop.departure_datetime) : ""
      }));
  }
  const bookingPassengerRows = tables.bookingPassengers.filter((item) => String(item.booking_id) === String(booking.booking_id));
  const passengers = bookingPassengerRows.map((row) => {
  const passenger = byId(tables.passengers, "passenger_id", row.passenger_id);
  return {
      passenger_name: passenger?.passenger_name || "",
      age: passenger?.age || "",
      gender: passenger?.gender || "",
      id_proof_number: passenger?.id_proof_number || "",
      fullName: passenger?.passenger_name || "",
      idProofNumber: passenger?.id_proof_number || ""
    };
  });
  const selectedSeats = bookingPassengerRows.map((row) => row.seat_number).filter(Boolean);
  const payment = tables.payments.find((item) => String(item.booking_id) === String(booking.booking_id));
  const cancellation = tables.cancellations.find((item) => String(item.booking_id) === String(booking.booking_id));

  return {
    id: booking.booking_id,
    booking_id: booking.booking_id,
    userId: booking.user_id,
    bookedByName: bookingUser?.full_name || "",
    bookedByDisplayId: bookingUser?.user_id || "",
    status: booking.booking_status,
    bookedAt: booking.booking_date,
    totalAmount: Number(booking.total_amount || 0),
    totalAmountLabel: formatCurrency(booking.total_amount),
    paymentStatus: payment?.payment_status || "Pending",
    passengers,
    selectedSeats,
    travel,
    pnr: booking.pnr_number,
    boardingLocationId: booking.boarding_location_id,
    droppingLocationId: booking.dropping_location_id,
    cancellation: cancellation
      ? {
          id: cancellation.cancellation_id,
          cancellationDate: cancellation.cancellation_date,
          refundAmount: Number(cancellation.refund_amount || 0),
          refundAmountLabel: formatCurrency(cancellation.refund_amount),
          reason: cancellation.cancellation_reason,
          refundStatus: cancellation.refund_status
        }
      : null
  };
}

function buildCancellationView(cancellation, tables) {
  const booking = byId(tables.bookings, "booking_id", cancellation.booking_id);
  const bookingView = booking ? buildBookingView(booking, tables) : null;
  return {
    id: cancellation.cancellation_id,
    bookingId: cancellation.booking_id,
    cancellationDate: cancellation.cancellation_date,
    refundAmount: Number(cancellation.refund_amount || 0),
    refundAmountLabel: formatCurrency(cancellation.refund_amount),
    reason: cancellation.cancellation_reason,
    refundStatus: cancellation.refund_status,
    bookedByName: bookingView?.bookedByName || "",
    bookedByDisplayId: bookingView?.bookedByDisplayId || "",
    passengerNames: bookingView?.passengers?.map((passenger) => passenger.fullName).filter(Boolean) || [],
    travelName: bookingView?.travel?.name || "",
    modeType: bookingView?.travel?.type || "",
    origin: bookingView?.travel?.origin || "",
    destination: bookingView?.travel?.destination || "",
    originLocationId: bookingView?.travel?.originLocationId || "",
    destinationLocationId: bookingView?.travel?.destinationLocationId || "",
    route: bookingView?.travel ? `${bookingView.travel.origin} to ${bookingView.travel.destination}` : "",
    journeyDate: bookingView?.travel?.departureDate || "",
    arrivalDate: bookingView?.travel?.arrivalDate || "",
    pnr: bookingView?.pnr || ""
  };
}

async function queryRows(connection, sql, binds = {}) {
  const result = await execute(connection, sql, binds);
  return normalizeRows(result.rows);
}
async function getNextSequenceValue(connection, sequenceName) {
  const rows = await queryRows(connection, `SELECT ${sequenceName}.NEXTVAL AS next_id FROM dual`);
  return rows[0].next_id;
}

async function getNextPrimaryKey(connection, tableName, columnName, sequenceName) {
  try {
    return await getNextSequenceValue(connection, sequenceName);
  } catch (error) {
    const rows = await queryRows(
      connection,
      `SELECT NVL(MAX(${columnName}), 0) + 1 AS next_id FROM ${tableName}`
    );
    return rows[0].next_id;
  }
}

async function deleteBookingResourceInternal(connection, bookingId) {
  const bookingRows = await queryRows(connection, "SELECT schedule_id FROM booking WHERE booking_id = :id", { id: bookingId });
  const seatRows = await queryRows(connection, "SELECT COUNT(*) AS seat_count FROM booking_passenger WHERE booking_id = :id", { id: bookingId });
  if (bookingRows.length) {
    await execute(connection, "UPDATE schedule SET seats_remaining = seats_remaining + :seat_count WHERE schedule_id = :schedule_id", {
      seat_count: Number(seatRows[0]?.seat_count || 0),
      schedule_id: bookingRows[0].schedule_id
    });
  }
  await execute(connection, "DELETE FROM payment WHERE booking_id = :id", { id: bookingId });
  await execute(connection, "DELETE FROM cancellation WHERE booking_id = :id", { id: bookingId });
  await execute(connection, "DELETE FROM booking_passenger WHERE booking_id = :id", { id: bookingId });
  await execute(connection, "DELETE FROM booking WHERE booking_id = :id", { id: bookingId });
}

async function deleteRouteResourceInternal(connection, routeId) {
  const scheduleIds = await queryRows(connection, "SELECT schedule_id FROM schedule WHERE route_id = :id", { id: routeId });
  for (const schedule of scheduleIds) {
    const bookings = await queryRows(connection, "SELECT booking_id FROM booking WHERE schedule_id = :schedule_id", { schedule_id: schedule.schedule_id });
    for (const booking of bookings) {
      await deleteBookingResourceInternal(connection, booking.booking_id);
    }
  }

  await execute(connection, "DELETE FROM route_stop WHERE route_id = :id", { id: routeId });
  await execute(connection, "DELETE FROM schedule WHERE route_id = :id", { id: routeId });
  await execute(connection, "DELETE FROM route WHERE route_id = :id", { id: routeId });
}

async function deleteVehicleRoutesInternal(connection, vehicleId) {
  const routes = await queryRows(connection, "SELECT DISTINCT route_id FROM schedule WHERE vehicle_id = :id", { id: vehicleId });
  for (const route of routes) {
    await deleteRouteResourceInternal(connection, route.route_id);
  }
}

async function loadTables(connection) {
  const users = await queryRows(connection, "SELECT user_id, full_name, email, phone, role, status FROM users");
  const modes = await queryRows(connection, "SELECT mode_id, mode_name FROM travel_mode ORDER BY mode_id");
  const operators = await queryRows(connection, "SELECT operator_id, operator_name, mode_id, contact_email, contact_phone FROM operator ORDER BY operator_id");
  const locations = await queryRows(connection, "SELECT location_id, location_name, city, state, country, location_type FROM location ORDER BY location_id");
  const passengers = await queryRows(connection, "SELECT passenger_id, user_id, passenger_name, age, gender, id_proof_type, id_proof_number FROM passenger");
  const vehicles = await queryRows(connection, "SELECT v.vehicle_id, v.operator_id, v.vehicle_number, v.vehicle_name, v.total_seats, v.status, o.mode_id FROM vehicle v JOIN operator o ON v.operator_id = o.operator_id");
  const routes = await queryRows(connection, "SELECT r.route_id, r.route_name, o.mode_id, o.operator_id, r.start_location_id, r.end_location_id FROM route r JOIN operator o ON r.operator_id = o.operator_id ORDER BY r.route_id");
  const routeStops = await queryRows(connection, "SELECT route_id, location_id, stop_sequence, arrival_datetime, departure_datetime FROM route_stop ORDER BY route_id, stop_sequence");
  const schedules = await queryRows(connection, "SELECT schedule_id, vehicle_id, route_id, departure_datetime, arrival_datetime, base_fare, seats_remaining, status FROM schedule ORDER BY schedule_id");
  const bookings = await queryRows(connection, "SELECT booking_id, user_id, schedule_id, boarding_location_id, dropping_location_id, booking_date, pnr_number, total_amount, booking_status FROM booking ORDER BY booking_id");
  const bookingPassengers = await queryRows(connection, "SELECT booking_id, passenger_id, seat_number, fare FROM booking_passenger ORDER BY booking_id");
  const payments = await queryRows(connection, "SELECT payment_id, booking_id, payment_date, payment_method, amount_paid, payment_status, transaction_ref FROM payment ORDER BY payment_id");
  const cancellations = await queryRows(connection, "SELECT cancellation_id, booking_id, cancellation_date, refund_amount, cancellation_reason, refund_status FROM cancellation ORDER BY cancellation_id");

  return {
    users,
    modes,
    operators,
    locations,
    passengers,
    vehicles,
    routes,
    routeStops,
    schedules,
    bookings,
    bookingPassengers,
    payments,
    cancellations
  };
}

function buildRecurringTravelOptions(route, schedule, tables, filters) {
  const baseLeg = findLeg(route, schedule, tables, filters, 0);
  if (!baseLeg) {
    return [];
  }

  if (!filters.departureDate) {
    return [{ offsetMs: 0, leg: baseLeg }];
  }

  const baseDeparture = new Date(schedule.departure_datetime);
  const baseOriginDeparture = new Date(baseLeg.origin.departure_datetime || schedule.departure_datetime);
  const baseArrival = new Date(schedule.arrival_datetime);
  const requestedDay = String(filters.departureDate || "").trim();

  if (Number.isNaN(baseDeparture.getTime()) || Number.isNaN(baseOriginDeparture.getTime()) || Number.isNaN(baseArrival.getTime()) || !requestedDay) {
    return [];
  }

  const requestedDate = new Date(`${requestedDay}T00:00:00`);
  if (Number.isNaN(requestedDate.getTime())) {
    return [];
  }
  const boardingDate = toDatePart(baseOriginDeparture);
  if (boardingDate !== requestedDay) {
    return [];
  }

  return [{ offsetMs: 0, leg: baseLeg }];
}

async function searchTravels(filters = {}) {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);

    return tables.schedules
      .filter((schedule) => {
        const route = byId(tables.routes, "route_id", schedule.route_id);
        const vehicle = byId(tables.vehicles, "vehicle_id", schedule.vehicle_id);
        return schedule.status === "active" && route && vehicle && String(vehicle.status).toLowerCase() === "active";
      })
      .flatMap((schedule) => {
        const route = byId(tables.routes, "route_id", schedule.route_id);
        if (!route) {
          return [];
        }

        return buildRecurringTravelOptions(route, schedule, tables, filters).map(({ offsetMs, leg }) => {
          const shiftedSchedule = buildShiftedSchedule(schedule, offsetMs);
          const boardingDateTime = leg.origin.departure_datetime || shiftedSchedule.departure_datetime;
          const droppingDateTime = leg.destination.arrival_datetime || shiftedSchedule.arrival_datetime;

          return buildTravelView(schedule, tables, {
            origin: leg.origin.city || leg.origin.location_name,
            destination: leg.destination.city || leg.destination.location_name,
            originLocationId: leg.origin.location_id,
            destinationLocationId: leg.destination.location_id,
            departureDate: toDatePart(boardingDateTime),
            arrivalDate: toDatePart(droppingDateTime),
            departureTime: leg.origin.departure_time || toTimePart(boardingDateTime),
            arrivalTime: leg.destination.arrival_time || toTimePart(droppingDateTime),
            departureDateTime: toDateTimeInput(boardingDateTime),
            arrivalDateTime: toDateTimeInput(droppingDateTime),
            amenities: leg.amenities.length ? leg.amenities : [byId(tables.modes, "mode_id", route.mode_id)?.mode_name || "travel"]
          }, offsetMs);
        });
      })
      .filter((travel) => !filters.type || String(travel.type).toLowerCase() === String(filters.type).toLowerCase());
  });
}

async function getTravelById(id) {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);
    const schedule = byId(tables.schedules, "schedule_id", id);
    const vehicle = schedule ? byId(tables.vehicles, "vehicle_id", schedule.vehicle_id) : null;
    if (!schedule || String(schedule.status).toLowerCase() !== "active" || !vehicle || String(vehicle.status).toLowerCase() !== "active") {
      return null;
    }

    return buildTravelView(schedule, tables);
  });
}

async function getBookingsByUser(userId) {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);
    return tables.bookings
      .filter((booking) => String(booking.user_id) === String(userId))
      .map((booking) => buildBookingView(booking, tables));
  });
}

async function getCancellationsByUser(userId) {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);
    const bookingIds = tables.bookings
      .filter((booking) => String(booking.user_id) === String(userId))
      .map((booking) => booking.booking_id);

    return tables.cancellations
      .filter((item) => bookingIds.includes(item.booking_id))
      .map((item) => buildCancellationView(item, tables));
  });
}

async function getAdminOverview() {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);
    const totalRevenue = tables.payments.filter(item => String(item.payment_status).toLowerCase() === "paid" || String(item.payment_status).toLowerCase() === "refund pending").reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);

    return {
      metrics: [
        { label: "Users", value: tables.users.length },
        { label: "Operators", value: tables.operators.length },
        { label: "Locations", value: tables.locations.length },
        { label: "Revenue", value: formatCurrency(totalRevenue) }
      ],
      bookings: tables.bookings.map((booking) => buildBookingView(booking, tables)),
      payments: tables.payments.map((payment) => ({
        id: payment.payment_id,
        method: payment.payment_method,
        status: payment.payment_status,
        amount: Number(payment.amount_paid || 0),
        amountLabel: formatCurrency(payment.amount_paid),
        bookingId: payment.booking_id,
        date: payment.payment_date
      })),
      cancellations: tables.cancellations.map((item) => buildCancellationView(item, tables))
    };
  });
}

async function getAdminResource(resourceKey) {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);

    if (resourceKey === "operators") {
      return tables.operators.map((operator) => ({
        id: operator.operator_id,
        operator_name: operator.operator_name,
        mode_type: String(byId(tables.modes, "mode_id", operator.mode_id)?.mode_name || "").toLowerCase(),
        contact_email: operator.contact_email,
        contact_phone: operator.contact_phone
      }));
    }

    if (resourceKey === "locations") {
      return tables.locations.map((location) => ({
        id: location.location_id,
        location_name: location.location_name,
        city: location.city,
        state: location.state,
        country: location.country,
        location_type: location.location_type
      }));
    }

    if (resourceKey === "vehicles") {
      return tables.vehicles.map((vehicle) => ({
        id: vehicle.vehicle_id,
        vehicle_id: vehicle.vehicle_id,
        mode_id: String(vehicle.mode_id),
        operator_id: String(vehicle.operator_id),
        vehicle_number: vehicle.vehicle_number,
        vehicle_name: vehicle.vehicle_name,
        total_seats: vehicle.total_seats,
        status: vehicle.status
      }));
    }

    if (resourceKey === "routes") {
      return tables.routes.map((route) => {
        const schedule = tables.schedules.find((entry) => String(entry.route_id) === String(route.route_id));
        const vehicle = byId(tables.vehicles, "vehicle_id", schedule?.vehicle_id);
        const start = byId(tables.locations, "location_id", route.start_location_id);
        const end = byId(tables.locations, "location_id", route.end_location_id);
        const stops = tables.routeStops
          .filter((stop) => String(stop.route_id) === String(route.route_id))
          .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
          .map((stop) => ({
            route_id: stop.route_id,
            location_id: String(stop.location_id),
            location_name: byId(tables.locations, "location_id", stop.location_id)?.location_name || "",
            city: byId(tables.locations, "location_id", stop.location_id)?.city || "",
            arrivalDateTime: toDateTimeInput(stop.arrival_datetime),
            departureDateTime: toDateTimeInput(stop.departure_datetime)
          }));
        return {
          id: route.route_id,
          mode_id: String(route.mode_id),
          mode_type: byId(tables.modes, "mode_id", route.mode_id)?.mode_name || "",
          origin: String(route.start_location_id),
          origin_name: start ? `${start.location_name} - ${start.city}` : "",
          destination: String(route.end_location_id),
          destination_name: end ? `${end.location_name} - ${end.city}` : "",
          arrivalDateTime: schedule ? toDateTimeInput(schedule.arrival_datetime) : "",
          departureDateTime: schedule ? toDateTimeInput(schedule.departure_datetime) : "",
          operator_id: String(route.operator_id),
          operator_name: byId(tables.operators, "operator_id", route.operator_id)?.operator_name || "",
          vehicle_id: vehicle ? String(vehicle.vehicle_id) : "",
          vehicle_name: vehicle?.vehicle_name || "",
          status: schedule?.status || "active",
          intermediateStops: stops
        };
      });
    }

    if (resourceKey === "bookings") {
      return tables.bookings.map((booking) => buildBookingView(booking, tables));
    }

    if (resourceKey === "payments") {
      return tables.payments.map((payment) => ({
        id: payment.payment_id,
        bookingId: payment.booking_id,
        method: payment.payment_method,
        status: payment.payment_status,
        amount: Number(payment.amount_paid || 0),
        amountLabel: formatCurrency(payment.amount_paid),
        date: toDatePart(payment.payment_date)
      }));
    }

    if (resourceKey === "cancellations") {
      return tables.cancellations.map((item) => buildCancellationView(item, tables));
    }

    return [];
  });
}

async function getVehicleFormOptions() {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);
    return {
      modes: tables.modes.map((mode) => ({ value: String(mode.mode_id), label: `${mode.mode_id} - ${mode.mode_name}` })),
      operators: tables.operators.map((operator) => ({
        value: String(operator.operator_id),
        label: `${operator.operator_id} - ${operator.operator_name}`,
        mode_id: String(operator.mode_id)
      }))
    };
  });
}

async function getTravelSearchOptions() {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);
    return {
      modes: tables.modes.map((mode) => ({
        value: String(mode.mode_name || "").trim().toLowerCase(),
        label: mode.mode_name
      })),
      locations: tables.locations.map((location) => buildLocationOption(location))
    };
  });
}

async function getRouteFormOptions() {
  return withConnection(async (connection) => {
    const tables = await loadTables(connection);
    const vehicleSchedules = tables.schedules.map((schedule) => ({
      schedule_id: schedule.schedule_id,
      vehicle_id: String(schedule.vehicle_id),
      route_id: String(schedule.route_id),
      departureDateTime: toDateTimeInput(schedule.departure_datetime),
      arrivalDateTime: toDateTimeInput(schedule.arrival_datetime)
    }));

    return {
      modes: tables.modes.map((mode) => ({ value: String(mode.mode_id), label: mode.mode_name })),
      locations: tables.locations.map((location) => buildLocationOption(location)),
      operators: tables.operators.map((operator) => ({
        value: String(operator.operator_id),
        label: `${operator.operator_id} - ${operator.operator_name}`,
        mode_id: String(operator.mode_id)
      })),
      vehicles: tables.vehicles
        .filter((vehicle) => String(vehicle.status).toLowerCase() === "active")
        .map((vehicle) => ({
        value: String(vehicle.vehicle_id),
        label: `${vehicle.vehicle_id} - ${vehicle.vehicle_name} (${vehicle.vehicle_number})`,
        mode_id: String(vehicle.mode_id),
        operator_id: String(vehicle.operator_id),
        assigned_route_id: String(vehicleSchedules.find((schedule) => String(schedule.vehicle_id) === String(vehicle.vehicle_id))?.route_id || ""),
        assignedSchedules: vehicleSchedules.filter((schedule) => String(schedule.vehicle_id) === String(vehicle.vehicle_id)),
        status: String(vehicle.status).toLowerCase()
      }))
    };
  });
}
async function createPassenger(connection, payload) {
  await execute(
    connection,
    `INSERT INTO passenger (passenger_id, user_id, passenger_name, age, gender, id_proof_type, id_proof_number)
     VALUES (:passenger_id, :user_id, :passenger_name, :age, :gender, :id_proof_type, :id_proof_number)`,
    {
      passenger_id: passengerId,
      user_id: payload.userId,
      passenger_name: payload.passenger_name,
      age: Number(payload.age),
      gender: payload.gender,
      id_proof_type: "Self Declared",
      id_proof_number: payload.id_proof_number
    }
  );

  return passengerId;
}

async function createBooking(payload) {
  return withTransaction(async (connection) => {
    const scheduleRows = await queryRows(connection, `SELECT schedule_id, vehicle_id, route_id, base_fare, seats_remaining, status FROM schedule WHERE schedule_id = :id  FOR UPDATE`, { id: payload.travelId });
    const schedule = scheduleRows[0];

    if (!schedule) {
      throw new Error("Selected travel could not be found.");
    }

    if (String(schedule.status).toLowerCase() !== "active") {
      throw new Error("This travel is not currently active for booking.");
    }

    const tables = await loadTables(connection);
    const route = byId(tables.routes, "route_id", schedule.route_id);
    const vehicle = byId(tables.vehicles, "vehicle_id", schedule.vehicle_id);

    if (!route || !vehicle || String(vehicle.status).toLowerCase() !== "active") {
      throw new Error("This travel is no longer available for booking.");
    }

    const seatCount = Number(payload.passengers?.length || 0);
    if (seatCount <= 0) {
      throw new Error("Add at least one passenger before booking.");
    }

    const hasInvalidPassenger = payload.passengers.some((passenger) => {
      const age = Number(passenger?.age);
      return !String(passenger?.passenger_name || "").trim()
        || !Number.isInteger(age)
        || age < 1
        || age > 120
        || !String(passenger?.gender || "").trim()
        || !String(passenger?.id_proof_number || "").trim();
    });

    if (hasInvalidPassenger) {
      throw new Error("Each passenger needs a valid name, age, gender, and ID proof number.");
    }

    const idSet = new Set();
    for (const passenger of payload.passengers) {
      const id = String(passenger.id_proof_number).trim();
      if (idSet.has(id)) {
        throw new Error("Duplicate ID proof number found in passengers. Each passenger must have a unique ID proof number.");
      }
      idSet.add(id);
    }

    if (Number(schedule.seats_remaining) < seatCount) {
      throw new Error("Not enough seats available for this travel.");
    }

    if (String(payload.boardingLocationId) === String(payload.droppingLocationId)) {
      throw new Error("Boarding and dropping locations cannot be the same.");
    }

    const routePath = getRoutePath(route, tables, schedule);
    const boardingIndex = routePath.findIndex(
          point => String(point.location_id) === String(payload.boardingLocationId)
    );
    const droppingIndex = routePath.findIndex(
          point => String(point.location_id) === String(payload.droppingLocationId)
    );

    if (boardingIndex === -1 || droppingIndex === -1 || boardingIndex >= droppingIndex) {
      throw new Error("Select a valid boarding and dropping combination for this route.");
    }

    const now = new Date();
    const boardingTime = routePath[boardingIndex]?.departure_datetime || schedule.departure_datetime;
    if (new Date(boardingTime) <= now) {
      throw new Error("Bookings closed! Departure time has passed.");
    }

    const bookedSeatRows = await queryRows(
      connection,
      `SELECT bp.seat_number
         FROM booking_passenger bp
         JOIN booking b ON b.booking_id = bp.booking_id
        WHERE b.schedule_id = :schedule_id
          AND LOWER(NVL(b.booking_status, 'confirmed')) <> 'cancelled'`,
      { schedule_id: payload.travelId }
    );
    const unavailableSeats = new Set(bookedSeatRows.map((row) => String(row.seat_number || "").trim()).filter(Boolean));
    const assignedSeats = assignSeats({
      totalSeats: vehicle.total_seats,
      bookedSeats: [...unavailableSeats],
      requestedSeatCount: seatCount
    });

    if (!String(payload.payment?.method || "").trim() || !String(payload.payment?.cardName || "").trim() || !String(payload.payment?.cardNumber || "").trim()) {
      throw new Error("Complete the payment details before confirming.");
    }

    const bookingId = await getNextPrimaryKey(connection, "booking", "booking_id", "booking_seq");
    const pnr = buildPnr(bookingId);
    const fare = Number(schedule.base_fare || 0);
    const totalAmount = fare * seatCount;

    await execute(
      connection,
      `INSERT INTO booking (booking_id, user_id, schedule_id, boarding_location_id, dropping_location_id, booking_date, pnr_number, total_amount, booking_status)
       VALUES (:booking_id, :user_id, :schedule_id, :boarding_location_id, :dropping_location_id, SYSTIMESTAMP, :pnr_number, :total_amount, 'Confirmed')`,
      {
        booking_id: bookingId,
        user_id: payload.userId,
        schedule_id: payload.travelId,
        boarding_location_id: payload.boardingLocationId,
        dropping_location_id: payload.droppingLocationId,
        pnr_number: pnr,
        total_amount: totalAmount
      }
    );

    for (let index = 0; index < payload.passengers.length; index += 1) {
      const passengerId = await createPassenger(connection, { ...payload.passengers[index], userId: payload.userId });
      await execute(
        connection,
        `INSERT INTO booking_passenger (booking_id, passenger_id, seat_number, fare)
         VALUES (:booking_id, :passenger_id, :seat_number, :fare)`,
        {
          booking_id: bookingId,
          passenger_id: passengerId,
          seat_number: assignedSeats[index],
          fare
        }
      );
    }

    const paymentId = await getNextPrimaryKey(connection, "payment", "payment_id", "payment_seq");
    await execute(
      connection,
      `INSERT INTO payment (payment_id, booking_id, payment_method, amount_paid, payment_status, transaction_ref)
       VALUES (:payment_id, :booking_id, :payment_method, :amount_paid, :payment_status, :transaction_ref)`,
      {
        payment_id: paymentId,
        booking_id: bookingId,
        payment_method: payload.payment.method,
        amount_paid: totalAmount,
        payment_status: "Paid",
        transaction_ref: `TXN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      }
    );

    const result = await execute(connection, `UPDATE schedule SET seats_remaining = seats_remaining - :seat_count WHERE schedule_id = :schedule_id AND seats_remaining >= :seat_count`, {
      seat_count: seatCount,
      schedule_id: payload.travelId
    });

    if (result.rowsAffected === 0) {
      throw new Error("Seats no longer available.");
    }

    const updatedTables = await loadTables(connection);
    return buildBookingView(byId(updatedTables.bookings, "booking_id", bookingId), updatedTables);
  });
}

async function cancelBooking(bookingId, actor = {}) {
  return withTransaction(async (connection) => {
    const bookingRows = await queryRows(connection, `SELECT booking_id, user_id, schedule_id, total_amount, booking_status FROM booking WHERE booking_id = :booking_id`, { booking_id: bookingId });
    const booking = bookingRows[0];

    if (!booking) {
      throw new Error("Booking not found.");
    }

    const scheduleRows = await queryRows(connection, `SELECT departure_datetime FROM schedule WHERE schedule_id = :id`, { id: booking.schedule_id });
    if(!scheduleRows.length) {
      throw new Error("Associated travel schedule not found.");
    }

    const departureTime = scheduleRows[0].departure_datetime;
    const now = new Date();
    if (departureTime && new Date(departureTime) <= now) {
      throw new Error("Cannot cancel booking for a travel that has already departed.");
    }

    const isAdmin = String(actor.role || "").toLowerCase() === "admin";
    if (!isAdmin && String(booking.user_id) !== String(actor.userId)) {
      throw new Error("You can only cancel your own bookings.");
    }

    if (String(booking.booking_status).toLowerCase() === "cancelled") {
      const tables = await loadTables(connection);
      return buildBookingView(byId(tables.bookings, "booking_id", bookingId), tables);
    }

    const seatRows = await queryRows(connection, `SELECT COUNT(*) AS seat_count FROM booking_passenger WHERE booking_id = :booking_id`, { booking_id: bookingId });
    const seatCount = Number(seatRows[0]?.seat_count || 0);
    const cancellationReason = actor.reason || (isAdmin ? "Cancelled by admin" : "Cancelled by user");

    await execute(connection, `UPDATE booking SET booking_status = 'Cancelled' WHERE booking_id = :booking_id`, { booking_id: bookingId });
    await execute(connection, `UPDATE schedule SET seats_remaining = seats_remaining + :seat_count WHERE schedule_id = :schedule_id`, {
      seat_count: seatCount,
      schedule_id: booking.schedule_id
    });
    await execute(connection, `UPDATE payment SET payment_status = 'Refund Pending' WHERE booking_id = :booking_id`, { booking_id: bookingId });

    const existingCancellation = await queryRows(connection, `SELECT cancellation_id FROM cancellation WHERE booking_id = :booking_id`, { booking_id: bookingId });
    if (existingCancellation.length) {
      await execute(
        connection,
        `UPDATE cancellation SET cancellation_date = TRUNC(SYSDATE), refund_amount = :refund_amount, cancellation_reason = :reason, refund_status = 'Initiated' WHERE booking_id = :booking_id`,
        {
          refund_amount: booking.total_amount,
          reason: cancellationReason,
          booking_id: bookingId
        }
      );
    } else {
      const cancellationId = await getNextPrimaryKey(connection, "cancellation", "cancellation_id", "cancellation_seq");
      await execute(
        connection,
        `INSERT INTO cancellation (cancellation_id, booking_id, cancellation_date, refund_amount, cancellation_reason, refund_status)
         VALUES (:cancellation_id, :booking_id, TRUNC(SYSDATE), :refund_amount, :reason, 'Initiated')`,
        {
          cancellation_id: cancellationId,
          booking_id: bookingId,
          refund_amount: booking.total_amount,
          reason: cancellationReason
        }
      );
    }

    const tables = await loadTables(connection);
    return buildBookingView(byId(tables.bookings, "booking_id", bookingId), tables);
  });
}


async function upsertAdminResource(resourceKey, record) {
  return withTransaction(async (connection) => {
    if (resourceKey === "operators") {
      const operatorName = String(record.operator_name || "").trim();
      const contactEmail = String(record.contact_email || "").trim();
      const contactPhone = String(record.contact_phone || "").trim();
      const mode = (await queryRows(connection, "SELECT mode_id, mode_name FROM travel_mode WHERE LOWER(mode_name) = LOWER(:mode_name)", { mode_name: record.mode_type }))[0];

      if (!operatorName || !contactEmail || !contactPhone) {
        throw new Error("Operator name, email, and phone are required.");
      }

      if (!mode) {
        throw new Error("Select a valid travel mode.");
      }

      if (record.id) {
        const existingOperator = (await queryRows(connection, "SELECT operator_id, mode_id FROM operator WHERE operator_id = :id", { id: Number(record.id) }))[0];
        if (!existingOperator) {
          throw new Error("Operator not found.");
        }

        if (String(existingOperator.mode_id) !== String(mode.mode_id)) {
          const linkedVehicle = (await queryRows(connection, "SELECT vehicle_id FROM vehicle WHERE operator_id = :id FETCH FIRST 1 ROWS ONLY", { id: Number(record.id) }))[0];
          const linkedRoute = (await queryRows(connection, "SELECT route_id FROM route WHERE operator_id = :id FETCH FIRST 1 ROWS ONLY", { id: Number(record.id) }))[0];

          if (linkedVehicle || linkedRoute) {
            throw new Error("Cannot change the operator mode while linked vehicles or routes still exist.");
          }
        }

        await execute(
          connection,
          `UPDATE operator
              SET operator_name = :operator_name,
                  mode_id = :mode_id,
                  contact_email = :contact_email,
                  contact_phone = :contact_phone
            WHERE operator_id = :id`,
          {
            id: Number(record.id),
            operator_name: operatorName,
            mode_id: mode.mode_id,
            contact_email: contactEmail,
            contact_phone: contactPhone
          }
        );

        return {
          id: Number(record.id),
          operator_name: operatorName,
          mode_type: String(mode.mode_name || "").toLowerCase(),
          contact_email: contactEmail,
          contact_phone: contactPhone
        };
      }

      const operatorId = await getNextPrimaryKey(connection, "operator", "operator_id", "operator_seq");
      await execute(connection, `INSERT INTO operator (operator_id, operator_name, mode_id, contact_email, contact_phone) VALUES (:operator_id, :operator_name, :mode_id, :contact_email, :contact_phone)`, {
        operator_id: operatorId,
        operator_name: operatorName,
        mode_id: mode.mode_id,
        contact_email: contactEmail,
        contact_phone: contactPhone
      });
      return {
        id: operatorId,
        operator_name: operatorName,
        mode_type: String(mode.mode_name || "").toLowerCase(),
        contact_email: contactEmail,
        contact_phone: contactPhone
      };
    }

    if (resourceKey === "locations") {
      if (record.id) {
        await execute(connection, `UPDATE location SET location_name = :location_name, city = :city, state = :state, country = :country, location_type = :location_type WHERE location_id = :id`, record);
        return { ...record, id: record.id };
      }

      const locationId = await getNextPrimaryKey(connection, "location", "location_id", "location_seq");
      await execute(connection, `INSERT INTO location (location_id, location_name, city, state, country, location_type) VALUES (:location_id, :location_name, :city, :state, :country, :location_type)`, {
        ...record,
        location_id: locationId
      });
      return { ...record, id: locationId };
    }

    if (resourceKey === "vehicles") {
      const operatorId = Number(record.operator_id);
      const totalSeats = Number(record.total_seats);
      const status = normalizeStatus(record.status, ["active", "inactive"], "active");

      if (record.id) {
        await execute(
          connection,
          `UPDATE vehicle
              SET operator_id = :operator_id,
                  vehicle_number = :vehicle_number,
                  vehicle_name = :vehicle_name,
                  total_seats = :total_seats,
                  status = :status
            WHERE vehicle_id = :vehicle_id`,
          {
            vehicle_id: Number(record.id),
            operator_id: operatorId,
            vehicle_number: record.vehicle_number,
            vehicle_name: record.vehicle_name,
            total_seats: totalSeats,
            status
          }
        );
        await execute(connection, `UPDATE schedule SET base_fare = :base_fare WHERE vehicle_id = :vehicle_id`, {
          vehicle_id: Number(record.id),
          base_fare: Number(request.base_fare)
        });
        if (status === "inactive") {
          await deleteVehicleRoutesInternal(connection, Number(record.id));
        }
        return { ...record, id: record.id };
      }

      const vehicleId = await getNextPrimaryKey(connection, "vehicle", "vehicle_id", "vehicle_seq");
      await execute(
        connection,
        `INSERT INTO vehicle (vehicle_id, operator_id, vehicle_number, vehicle_name, total_seats, status) VALUES (:vehicle_id, :operator_id, :vehicle_number, :vehicle_name, :total_seats, :status)`,
        {
          vehicle_id: vehicleId,
          operator_id: operatorId,
          vehicle_number: record.vehicle_number,
          vehicle_name: record.vehicle_name,
          total_seats: totalSeats,
          status
        }
      );
      return { ...record, id: vehicleId };
    }

    if (resourceKey === "bookings") {
      if (String(record.action || "").toLowerCase() === "cancel") {
        return cancelBooking(record.id, {
          role: "admin",
          reason: record.reason || "Cancelled by admin"
        });
      }

      throw new Error("Unsupported booking action.");
    }

    if (resourceKey === "cancellations") {
      const refundAmount = Number(record.refundAmount);
      if (Number.isNaN(refundAmount) || refundAmount < 0) {
        throw new Error("Reimbursement amount must be zero or more.");
      }

      await execute(
        connection,
        `UPDATE cancellation
            SET refund_amount = :refund_amount,
                refund_status = :refund_status,
                cancellation_reason = :cancellation_reason
          WHERE cancellation_id = :cancellation_id`,
        {
          cancellation_id: Number(record.id),
          refund_amount: refundAmount,
          refund_status: record.refundStatus || "Initiated",
          cancellation_reason: record.reason || null
        }
      );

      await execute(
        connection,
        `UPDATE payment
            SET payment_status = :payment_status
          WHERE booking_id = :booking_id`,
        {
          booking_id: Number(record.bookingId),
          payment_status: String(record.refundStatus || "Initiated").toLowerCase() === "reimbursed" ? "Refunded" : "Refund Pending"
        }
      );

      const tables = await loadTables(connection);
      const updatedCancellation = byId(tables.cancellations, "cancellation_id", record.id);
      return buildCancellationView(updatedCancellation, tables);
    }

    if (resourceKey === "routes") {
      const routeId = record.id || await getNextPrimaryKey(connection, "route", "route_id", "route_seq");
      const routeName = `RT-${routeId}`;
      const vehicleRows = await queryRows(connection, "SELECT v.total_seats, o.operator_id, o.mode_id, v.status FROM vehicle v JOIN operator o ON v.operator_id = o.operator_id WHERE v.vehicle_id = :vehicle_id", { vehicle_id: Number(record.vehicle_id) });
      const existingSchedule = (await queryRows(connection, "SELECT schedule_id, seats_remaining FROM schedule WHERE route_id = :route_id", { route_id: routeId }))[0];
      const routeStatus = normalizeStatus(record.status, ["active", "inactive"], "active");
      const selectedVehicle = vehicleRows[0];

      if (!selectedVehicle) {
        throw new Error("Select a valid vehicle.");
      }

      if (String(selectedVehicle.status).toLowerCase() !== "active") {
        throw new Error("Only active vehicles can be assigned to a route.");
      }

      if (String(selectedVehicle.mode_id) !== String(record.mode_id)) {
        throw new Error("Route mode and vehicle mode must match.");
      }

      if (String(selectedVehicle.operator_id) !== String(record.operator_id)) {
        throw new Error("The selected vehicle must belong to the selected operator.");
      }

      const conflictingSchedule = (
        await queryRows(
          connection,
          `SELECT schedule_id, route_id
             FROM schedule
            WHERE vehicle_id = :vehicle_id
              AND route_id <> :route_id
              AND TO_TIMESTAMP(:departure_datetime, 'YYYY-MM-DD"T"HH24:MI') < arrival_datetime
              AND TO_TIMESTAMP(:arrival_datetime, 'YYYY-MM-DD"T"HH24:MI') > departure_datetime`,
          {
            vehicle_id: Number(record.vehicle_id),
            route_id: Number(routeId),
            departure_datetime: record.departureDateTime,
            arrival_datetime: record.arrivalDateTime
          }
        )
      )[0];

      if (conflictingSchedule) {
        throw new Error("This vehicle is already booked for another route at the selected time.");
      }

      if (record.id) {
        await execute(connection, `UPDATE route SET operator_id = :operator_id, start_location_id = :origin, end_location_id = :destination WHERE route_id = :route_id`, {
          operator_id: Number(record.operator_id),
          origin: Number(record.origin),
          destination: Number(record.destination),
          route_id: routeId
        });
      } else {
        await execute(connection, `INSERT INTO route (route_id, route_name, operator_id, start_location_id, end_location_id) VALUES (:route_id, :route_name, :operator_id, :origin, :destination)`, {
          route_id: routeId,
          route_name: routeName,
          operator_id: Number(record.operator_id),
          origin: Number(record.origin),
          destination: Number(record.destination)
        });
      }

      await execute(connection, "DELETE FROM route_stop WHERE route_id = :route_id", { route_id: routeId });
      let previousDeparture = null;
      for (let index = 0; index < (record.intermediateStops || []).length; index += 1) {
        const stop = record.intermediateStops[index];
        const shiftedArrival = new Date(stop.arrivalDateTime);
        const shiftedDeparture = new Date(stop.departureDateTime);
        if (shiftedArrival && shiftedDeparture && shiftedArrival > shiftedDeparture) {
          throw new Error("Invalid stop timing. Arrival cannot be after departure");
        }
        await execute(connection, `INSERT INTO route_stop (
                                    route_id,
                                    location_id,
                                    stop_sequence,
                                    arrival_datetime,
                                    departure_datetime
                                   ) VALUES (
                                    :route_id,
                                    :location_id,
                                    :stop_sequence,
                                    TO_TIMESTAMP(:arrival_datetime, 'YYYY-MM-DD"T"HH24:MI'), 
                                    TO_TIMESTAMP(:departure_datetime, 'YYYY-MM-DD"T"HH24:MI'))`, {
          route_id: routeId,
          location_id: Number(stop.location_id),
          stop_sequence: index + 1,
          arrival_datetime: stop.arrivalDateTime,
          departure_datetime: stop.departureDateTime
        });

        if(previousDeparture && shiftedArrival < previousDeparture) {
          throw new Error("Stops must be in chronological order.");
        }
        previousDeparture = shiftedDeparture;
      }

      if (existingSchedule) {
        await execute(connection, `UPDATE schedule SET vehicle_id = :vehicle_id, departure_datetime = TO_TIMESTAMP(:departure_datetime, 'YYYY-MM-DD"T"HH24:MI'), arrival_datetime = TO_TIMESTAMP(:arrival_datetime, 'YYYY-MM-DD"T"HH24:MI'), base_fare = :baseFare, seats_remaining = LEAST(:vehicle_capacity, seats_remaining), status = :status WHERE schedule_id = :schedule_id`, {
          vehicle_id: Number(record.vehicle_id),
          departure_datetime: record.departureDateTime,
          arrival_datetime: record.arrivalDateTime,
          baseFare: Number(request.base_fare),
          vehicle_capacity: Number(vehicleRows[0]?.total_seats || 0),
          status: routeStatus,
          schedule_id: existingSchedule.schedule_id
        });
      } else {
        const scheduleId = await getNextPrimaryKey(connection, "schedule", "schedule_id", "schedule_seq");
        await execute(connection, `INSERT INTO schedule (schedule_id, route_id, vehicle_id, departure_datetime, arrival_datetime, base_fare, seats_remaining, status) VALUES (:schedule_id, :route_id, :vehicle_id, TO_TIMESTAMP(:departure_datetime, 'YYYY-MM-DD"T"HH24:MI'), TO_TIMESTAMP(:arrival_datetime, 'YYYY-MM-DD"T"HH24:MI'), :baseFare, :seats_remaining, :status)`, {
          schedule_id: scheduleId,
          route_id: routeId,
          vehicle_id: Number(record.vehicle_id),
          departure_datetime: record.departureDateTime,
          arrival_datetime: record.arrivalDateTime,
          baseFare: Number(request.base_fare),
          seats_remaining: Number(vehicleRows[0]?.total_seats || 0),
          status: routeStatus
        });
      }

      return { ...record, id: routeId };
    }

    return record;
  });
}

async function deleteAdminResource(resourceKey, recordId) {
  return withTransaction(async (connection) => {
    if (resourceKey === "bookings") {
      await deleteBookingResourceInternal(connection, recordId);
      return { success: true };
    }

    if (resourceKey === "routes") {
      await deleteRouteResourceInternal(connection, recordId);
      return { success: true };
    }

    if (resourceKey === "vehicles") {
      await deleteVehicleRoutesInternal(connection, recordId);
      await execute(connection, "DELETE FROM vehicle WHERE vehicle_id = :id", { id: recordId });
      return { success: true };
    }

    if (resourceKey === "locations") {
      const routes = await queryRows(connection, `SELECT DISTINCT route_id FROM route_stop WHERE location_id = :id
        UNION SELECT route_id FROM route WHERE start_location_id = :id OR end_location_id = :id`, { id: recordId });
      for (const route of routes) {
        await deleteRouteResourceInternal(connection, route.route_id);
      }
      await execute(connection, "DELETE FROM location WHERE location_id = :id", { id: recordId });
      return { success: true };
    }

    if (resourceKey === "operators") {
      await execute(connection, "DELETE FROM operator WHERE operator_id = :id", { id: recordId });
      return { success: true };
    }

    return { success: true };
  });
}


module.exports = {
  searchTravels,
  getTravelById,
  createBooking,
  getBookingsByUser,
  getCancellationsByUser,
  cancelBooking,
  getAdminOverview,
  getAdminResource,
  getVehicleFormOptions,
  getTravelSearchOptions,
  getRouteFormOptions,
  upsertAdminResource,
  deleteAdminResource
};