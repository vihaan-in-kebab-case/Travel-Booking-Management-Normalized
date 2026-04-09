const {
  createBooking,
  getBookingsByUser,
  getCancellationsByUser,
  cancelBooking
} = require("../services/travelDataService");

async function addBooking(req, res) {
  try {
    const booking = await createBooking({ ...req.body, userId: req.user.user_id });
    res.status(201).json(booking);
  } catch (error) {
    console.error("Create Booking Error:", error);
    res.status(500).json({ message: error.message || "Unable to create booking" });
  }
}

async function fetchBookingsByUser(req, res) {
  try {
    if (String(req.user.user_id) !== String(req.params.userId)) {
      return res.status(403).json({ message: "You can only view your own bookings." });
    }

    const bookings = await getBookingsByUser(req.user.user_id);
    res.json(bookings);
  } catch (error) {
    console.error("Fetch Bookings Error:", error);
    res.status(500).json({ message: error.message || "Unable to fetch bookings" });
  }
}

async function fetchCancellationsByUser(req, res) {
  try {
    if (String(req.user.user_id) !== String(req.params.userId)) {
      return res.status(403).json({ message: "You can only view your own cancellations." });
    }

    const cancellations = await getCancellationsByUser(req.user.user_id);
    res.json(cancellations);
  } catch (error) {
    console.error("Fetch Cancellations Error:", error);
    res.status(500).json({ message: error.message || "Unable to fetch cancellations" });
  }
}

async function cancelExistingBooking(req, res) {
  try {
    const booking = await cancelBooking(req.params.bookingId, {
      userId: req.user.user_id,
      role: req.user.role,
      reason: "Cancelled by user"
    });
    res.json(booking);
  } catch (error) {
    console.error("Cancel Booking Error:", error);
    const status = error.message === "Booking not found." ? 404 : error.message === "You can only cancel your own bookings." ? 403 : 500;
    res.status(status).json({ message: error.message || "Unable to cancel booking" });
  }
}

module.exports = {
  addBooking,
  fetchBookingsByUser,
  fetchCancellationsByUser,
  cancelExistingBooking
};
