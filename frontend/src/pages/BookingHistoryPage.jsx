import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cancelBooking, getBookingsByUser, getCancellationsByUser } from "../services/travelService";
import { formatDate, formatDateTime } from "../utils/dateTime";

function BookingHistoryPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(location.state?.successMessage || "");
  const [loading, setLoading] = useState(true);

  const loadBookings = async () => {
    if (!user?.user_id) {
      setBookings([]);
      setCancellations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [bookingResult, cancellationResult] = await Promise.all([
        getBookingsByUser(user.user_id),
        getCancellationsByUser(user.user_id)
      ]);
      setBookings(bookingResult);
      setCancellations(cancellationResult);
    } catch (loadError) {
      setError(loadError.message || "Unable to load your bookings right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [user?.user_id]);

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
    }
  }, [location.state]);

  const highlightedBooking = useMemo(() => {
    const selectedId = location.state?.bookingId;
    if (!selectedId) {
      return bookings[0] || null;
    }

    return bookings.find((booking) => String(booking.id) === String(selectedId)) || bookings[0] || null;
  }, [bookings, location.state]);

  const handleCancel = async (bookingId) => {
    try {
      setError("");
      setSuccessMessage("");
      const updatedBooking = await cancelBooking(bookingId);
      await loadBookings();
      setSuccessMessage(`Booking ${updatedBooking.pnr} has been cancelled.`);
    } catch (cancelError) {
      setError(cancelError.message || "Unable to cancel this booking.");
    }
  };

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">My Trips</p>
          <h1>Booking history and cancellations</h1>
        </div>
      </div>

      {successMessage && <p className="helper-text">{successMessage}</p>}
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading your bookings...</p>}


      <div className="history-list">
        {bookings.length === 0 && !loading ? (
          <article className="panel history-card">
            <p className="eyebrow">No Bookings Yet</p>
            <p className="helper-text">Your confirmed tickets will appear here once you book a trip.</p>
          </article>
        ) : bookings.map((booking) => (
          <article key={booking.id} className="panel history-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {String(booking.id) === String(highlightedBooking?.id) ? "Latest Ticket" : `Booking ${booking.id}`}
                </p>
                <h3>{booking.travel?.name}</h3>
                <p>
                  {booking.travel?.origin} to {booking.travel?.destination}
                </p>
              </div>
              <span className={`status-badge ${booking.status.toLowerCase()}`}>
                {booking.status}
              </span>
            </div>

            <div className="meta-grid">
              <span>Booking ID: {booking.id}</span>
              <span>Departure: {formatDateTime(booking.travel?.departureDateTime)}</span>
              <span>Arrival: {formatDateTime(booking.travel?.arrivalDateTime)}</span>
              <span>Seats: {booking.selectedSeats.join(", ")}</span>
              <span>Passengers: {booking.passengers.length}</span>
              <span>Total: {booking.totalAmountLabel}</span>
              <span>Payment: {booking.paymentStatus}</span>
              <span>PNR: {booking.pnr}</span>
            </div>

            <div className="meta-grid">
              <span>Passenger Names: {booking.passengers.map((passenger) => passenger.fullName).filter(Boolean).join(", ") || "-"}</span>
            </div>

            {booking.cancellation && (
              <div className="meta-grid">
                <span>Reimbursement: {booking.cancellation.refundAmountLabel}</span>
                <span>Reimbursement Status: {booking.cancellation.refundStatus}</span>
                <span>Cancellation Reason: {booking.cancellation.reason || "-"}</span>
                <span>Cancelled On: {formatDate(booking.cancellation.cancellationDate)}</span>
              </div>
            )}

            <div className="panel">
              <p className="eyebrow">Intermediate Stops</p>
              <div className="history-stops-list">
                {booking.travel?.intermediateStops?.length ? (
                  booking.travel.intermediateStops.map((stop) => (
                    <div key={`${booking.id}-${stop.location_id}-${stop.arrivalDateTime}`} className="history-stop-row">
                      <strong>{stop.location_name || stop.city}</strong>
                      <span>Arrival: {formatDateTime(stop.arrivalDateTime)}</span>
                      <span>Departure: {formatDateTime(stop.departureDateTime)}</span>
                    </div>
                  ))
                ) : (
                  <span className="helper-text">Direct route</span>
                )}
              </div>
            </div>

            {booking.status !== "Cancelled" && (
              <button
                type="button"
                className="ghost-button danger"
                onClick={() => handleCancel(booking.id)}
              >
                Cancel Booking
              </button>
            )}
          </article>
        ))}
      </div>

      <div className="panel table-wrap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">My Cancellations</p>
            <h3>Cancellation Table</h3>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Booking ID</th>
              <th>Route</th>
              <th>Journey Date</th>
              <th>Cancelled On</th>
              <th>Reimbursement</th>
              <th>Reimbursement Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {cancellations.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.bookingId}</td>
                <td>{record.route || record.travelName}</td>
                <td>{formatDate(record.journeyDate)}</td>
                <td>{formatDate(record.cancellationDate)}</td>
                <td>{record.refundAmountLabel}</td>
                <td>{record.refundStatus}</td>
                <td>{record.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default BookingHistoryPage;










