const express = require("express");
const router = express.Router();
const {
  addBooking,
  fetchBookingsByUser,
  fetchCancellationsByUser,
  cancelExistingBooking
} = require("../controllers/bookingController");
const protect = require("../middleware/authMiddleware");

router.post("/", protect, addBooking);
router.get("/user/:userId", protect, fetchBookingsByUser);
router.get("/user/:userId/cancellations", protect, fetchCancellationsByUser);
router.patch("/:bookingId/cancel", protect, cancelExistingBooking);

module.exports = router;
