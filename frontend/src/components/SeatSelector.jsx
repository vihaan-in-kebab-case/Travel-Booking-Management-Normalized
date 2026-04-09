function SeatSelector({ seatMap, assignedSeats = [], requestedSeats = 0, unavailableSeats = [] }) {
  const blockedSeats = new Set(unavailableSeats.map((seat) => String(seat)));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h3>Seat Assignment</h3>
          <p className="helper-text">
            Seats are assigned automatically when you confirm the booking.
            {requestedSeats > 0 ? ` ${requestedSeats} seat${requestedSeats === 1 ? "" : "s"} will be reserved for ${requestedSeats} passenger${requestedSeats === 1 ? "" : "s"}.` : ""}
          </p>
        </div>
        <span className="user-pill">{assignedSeats.length} queued</span>
      </div>

      <div className="seat-map">
        {seatMap.map((row, rowIndex) => (
          <div key={rowIndex} className="seat-row">
            {row.map((seat) => (
              <button
                key={seat}
                type="button"
                className={`seat ${blockedSeats.has(seat) ? "disabled" : ""} ${assignedSeats.includes(seat) ? "active" : ""}`}
                disabled
              >
                {seat}
              </button>
            ))}
          </div>
        ))}
      </div>

      {assignedSeats.length > 0 && (
        <p className="helper-text">Current auto-assignment preview: {assignedSeats.join(", ")}.</p>
      )}
      {blockedSeats.size > 0 && (
        <p className="helper-text">Greyed-out seats are already booked. Highlighted seats are the next seats currently available for auto-assignment.</p>
      )}
    </section>
  );
}

export default SeatSelector;
