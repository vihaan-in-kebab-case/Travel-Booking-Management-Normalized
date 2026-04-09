function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// BCNF change: mode_id removed from route — operator implies mode.
// base_fare validation added.
export function validateRouteForm(form) {
  if (!form.origin) {
    return "Select an origin location.";
  }

  if (!form.destination) {
    return "Select a destination location.";
  }

  if (String(form.origin) === String(form.destination)) {
    return "Origin and destination cannot be the same.";
  }

  if (!form.departureDateTime) {
    return "Select a route departure date and time.";
  }

  if (!form.arrivalDateTime) {
    return "Select a route arrival date and time.";
  }

  const departureDateTime = parseDateTime(form.departureDateTime);
  const arrivalDateTime = parseDateTime(form.arrivalDateTime);

  if (!departureDateTime || !arrivalDateTime) {
    return "Enter valid route departure and arrival date-time values.";
  }

  if (departureDateTime >= arrivalDateTime) {
    return "Route arrival date and time must be after the departure date and time.";
  }

  const baseFare = Number(form.base_fare);
  if (form.base_fare === "" || form.base_fare === null || form.base_fare === undefined) {
    return "Enter a base fare for this route.";
  }
  if (Number.isNaN(baseFare) || baseFare < 0) {
    return "Base fare must be zero or a positive number.";
  }

  if (!form.operator_id) {
    return "Select an operator.";
  }

  if (!form.vehicle_id) {
    return "Select a vehicle.";
  }

  const seenLocations = new Set([String(form.origin), String(form.destination)]);
  let previousDepartureDateTime = departureDateTime;

  for (let index = 0; index < (form.intermediateStops || []).length; index += 1) {
    const stop = form.intermediateStops[index];
    const stopLabel = `Intermediate stop ${index + 1}`;

    if (!stop.location_id) {
      return `${stopLabel} needs a location.`;
    }

    if (!stop.arrivalDateTime || !stop.departureDateTime) {
      return `${stopLabel} needs both arrival and departure date-time values.`;
    }

    const stopArrivalDateTime = parseDateTime(stop.arrivalDateTime);
    const stopDepartureDateTime = parseDateTime(stop.departureDateTime);

    if (!stopArrivalDateTime || !stopDepartureDateTime) {
      return `${stopLabel} has an invalid date-time value.`;
    }

    if (seenLocations.has(String(stop.location_id))) {
      return "Intermediate stops must be unique and cannot match the origin or destination.";
    }

    if (stopArrivalDateTime >= stopDepartureDateTime) {
      return `${stopLabel} arrival date-time must be before its departure date-time.`;
    }

    if (stopArrivalDateTime <= previousDepartureDateTime) {
      return `${stopLabel} must occur after the previous departure.`;
    }

    if (stopDepartureDateTime >= arrivalDateTime) {
      return `${stopLabel} must end before the route arrival date-time.`;
    }

    seenLocations.add(String(stop.location_id));
    previousDepartureDateTime = stopDepartureDateTime;
  }

  return "";
}

export function validateSearchFilters(filters) {
  if (
    filters.origin &&
    filters.destination &&
    normalizeText(filters.origin) === normalizeText(filters.destination)
  ) {
    return "Origin and destination cannot be the same.";
  }

  return "";
}

// BCNF change: mode_id removed from vehicle — operator already carries mode_id.
// Validation no longer checks mode_id or the mode/operator match (that's structural now).
export function validateVehicleForm(form, operatorOptions = []) {
  if (!form.operator_id) {
    return "Select an operator.";
  }

  const selectedOperator = operatorOptions.find(
    (option) => String(option.value) === String(form.operator_id)
  );

  if (!selectedOperator) {
    return "Select a valid operator.";
  }

  if (!String(form.vehicle_number || "").trim()) {
    return "Enter a vehicle number.";
  }

  if (!String(form.vehicle_name || "").trim()) {
    return "Enter a vehicle name.";
  }

  const seatCount = Number(form.total_seats);
  if (!Number.isInteger(seatCount) || seatCount <= 0) {
    return "Total seats must be a positive whole number.";
  }

  if (!["active", "inactive"].includes(String(form.status || "").toLowerCase())) {
    return "Vehicle status must be Active or Inactive.";
  }

  return "";
}
