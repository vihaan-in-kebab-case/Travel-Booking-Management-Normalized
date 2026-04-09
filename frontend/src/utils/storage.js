const STORAGE_KEYS = [
  "users",
  "travel_mode",
  "operator",
  "location",
  "passenger",
  "vehicle",
  "route",
  "route_stop",
  "schedule",
  "booking",
  "booking_passenger",
  "payment",
  "cancellation"
];

export function clearMockStorage() {
  STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}
