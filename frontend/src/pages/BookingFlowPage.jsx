import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PassengerForm from "../components/PassengerForm";
import PaymentForm from "../components/PaymentForm";
import { useAuth } from "../context/AuthContext";
import { createBooking, getTravelById } from "../services/travelService";
import { formatDateTime } from "../utils/dateTime";

function BookingFlowPage() {
  const { travelId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [travel, setTravel] = useState(location.state?.travel || null);
  const [passengers, setPassengers] = useState([
    { passenger_name: "", age: "", gender: "Male", id_proof_number: "", isSaved: false }
  ]);
  const [payment, setPayment] = useState({ method: "Card", cardName: "", cardNumber: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTravel = async () => {
      const stateTravel = location.state?.travel || null;
      if (stateTravel) {
        setTravel(stateTravel);
      }

      try {
        const result = await getTravelById(travelId);
        if (!result) {
          setTravel(stateTravel);
          return;
        }

        setTravel((current) => current
          ? {
              ...current,
              seatsAvailable: result.seatsAvailable
            }
          : result);
      } catch {
        setTravel(stateTravel);
      }
    };

    loadTravel();
  }, [location.state, travelId]);

  const maxPassengers = Number(travel?.seatsAvailable || 0);

  useEffect(() => {
    if (!maxPassengers) {
      return;
    }

    setPassengers((current) => current.slice(0, maxPassengers));
  }, [maxPassengers]);

  const savedPassengers = useMemo(() => passengers.filter((passenger) => passenger.isSaved), [passengers]);
  const totalAmount = useMemo(() => (travel ? savedPassengers.length * travel.price : 0), [savedPassengers.length, travel]);
  const intermediateStops = useMemo(() => {
    if (!travel?.intermediateStops?.length) return [];
    const allStops = travel.intermediateStops;
    const boardingIndex = allStops.findIndex((stop) => String(stop.location_id) === String(travel.originLocationId));
    const droppingIndex = allStops.findIndex((stop) => String(stop.location_id) === String(travel.destinationLocationId));
    if (boardingIndex !== -1 && droppingIndex !== -1 && boardingIndex >= droppingIndex) {
      return [];
    }

    return allStops.slice(boardingIndex + 1, droppingIndex);
  });

  const handleBooking = async () => {
    if (!travel) {
      return;
    }

    if (!user?.user_id) {
      setError("Please sign in again before booking.");
      return;
    }

    if (maxPassengers <= 0) {
      setError("No seats are available for this trip.");
      return;
    }

    const hasSavedPassengers = savedPassengers.every(
      (passenger) => passenger.passenger_name && passenger.age && passenger.gender && passenger.id_proof_number
    );

    if (!hasSavedPassengers || !savedPassengers.length) {
      setError("Save at least one passenger before confirming the booking.");
      return;
    }

    const invalidPassenger = savedPassengers.find((passenger) => {
      const age = Number(passenger.age);
      return !String(passenger.passenger_name || "").trim() || Number.isNaN(age) || age < 1 || age > 120 || !String(passenger.gender || "").trim() || !String(passenger.id_proof_number || "").trim();
    });

    if (invalidPassenger) {
      setError("Each saved passenger needs a name, age between 1 and 120, gender, and ID proof number.");
      return;
    }

    if (savedPassengers.length > maxPassengers) {
      setError(`Only ${maxPassengers} passenger${maxPassengers === 1 ? " is" : "s are"} allowed for this trip.`);
      return;
    }

    if (!String(payment.cardName || "").trim() || !String(payment.cardNumber || "").trim()) {
      setError("Complete the payment details before confirming.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const booking = await createBooking({
        userId: user.user_id,
        travelId: travel.id,
        boardingLocationId: travel.originLocationId,
        droppingLocationId: travel.destinationLocationId,
        passengers: savedPassengers,
        totalAmount,
        payment
      });

      navigate("/history", {
        state: {
          bookingId: booking.id,
          successMessage: `Booking confirmed. Booking ID ${booking.id}, Ticket ${booking.pnr} is ready.`
        }
      });
    } catch (submitError) {
      setError(submitError.message || "Unable to create booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!travel) {
    return <section className="page-shell">Loading booking details...</section>;
  }

  return (
    <section className="page-shell booking-page">
      <div className="booking-summary panel">
        <p className="eyebrow">{travel.type}</p>
        <h1>{travel.name}</h1>
        <p>
          {travel.origin} to {travel.destination}
        </p>
        <div className="meta-grid">
          <span>Departure: {formatDateTime(travel.departureDateTime)}</span>
          <span>Arrival: {formatDateTime(travel.arrivalDateTime)}</span>
          <span>{travel.seatsAvailable} seats remaining</span>
          <span>{travel.price} per seat</span>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {intermediateStops.length > 0 && (
        <div className="panel">
          <p className="eyebrow">Intermediate Stops</p>
          <div className="history-stops-list">
            {intermediateStops.map((stop, index) => (
              <div key={`${stop.location_id}-${index}`} className="history-stop-row">
                <strong>{stop.location_name || stop.city}</strong>
                <span>Arrival: {formatDateTime(stop.arrivalDateTime)}</span>
                <span>Departure: {formatDateTime(stop.departureDateTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PassengerForm passengers={passengers} onChange={setPassengers} maxPassengers={maxPassengers} />
      <PaymentForm payment={payment} onChange={setPayment} totalAmount={totalAmount} onSubmit={handleBooking} submitting={submitting} />
    </section>
  );
}

export default BookingFlowPage;









