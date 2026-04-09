import { useEffect, useMemo, useState } from "react";
import { deleteAdminResource, getAdminResource, upsertAdminResource } from "../../services/travelService";

function AdminBookingsPage() {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");

  const loadRecords = async () => {
    const result = await getAdminResource("bookings");
    setRecords(result);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleCancel = async (recordId) => {
    try {
      setError("");
      await upsertAdminResource("bookings", {
        id: recordId,
        action: "cancel",
        reason: "Cancelled by admin"
      });
      await loadRecords();
    } catch (cancelError) {
      setError(cancelError.message || "Unable to cancel booking.");
    }
  };

  const handleDelete = async (recordId) => {
    try {
      setError("");
      await deleteAdminResource("bookings", recordId);
      await loadRecords();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to remove booking.");
    }
  };

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return records;
    }

    return records.filter((record) =>
      [
        record.id,
        record.bookedByName,
        record.bookedByDisplayId,
        record.passengers.map((passenger) => passenger.fullName).join(", "),
        record.travel?.name,
        record.status,
        record.paymentStatus,
        record.selectedSeats.join(", "),
        record.pnr
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [records, searchTerm]);

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Bookings</h1>
          <p>View reservations, passenger details, booking user IDs, payment state, trip assignments, and cancel trips when needed.</p>
        </div>
      </div>
      <div className="panel table-wrap">
        {error && <p className="error-text">{error}</p>}
        <input
          type="text"
          placeholder="Search bookings"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Booked By</th>
              <th>User ID</th>
              <th>Trip</th>
              <th>Passenger Names</th>
              <th>Seats</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.bookedByName || "-"}</td>
                <td>{record.bookedByDisplayId || record.userId}</td>
                <td>{record.travel?.name || record.travelId}</td>
                <td>{record.passengers.map((passenger) => passenger.fullName).filter(Boolean).join(", ") || "-"}</td>
                <td>{record.selectedSeats.join(", ")}</td>
                <td>{record.status}</td>
                <td>{record.paymentStatus}</td>
                <td>
                  {record.status !== "Cancelled" && (
                    <button
                      type="button"
                      className="ghost-button danger"
                      onClick={() => handleCancel(record.id)}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => handleDelete(record.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AdminBookingsPage;
