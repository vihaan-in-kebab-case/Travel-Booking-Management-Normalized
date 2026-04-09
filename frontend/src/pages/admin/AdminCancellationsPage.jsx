import { useEffect, useMemo, useState } from "react";
import { getAdminResource, upsertAdminResource } from "../../services/travelService";
import { formatDate } from "../../utils/dateTime";

function formatModeLabel(value) {
  const mode = String(value || "").trim();
  if (!mode) {
    return "";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function AdminCancellationsPage() {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    modeType: "",
    originLocationId: "",
    destinationLocationId: ""
  });
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  const loadRecords = async () => {
    const result = await getAdminResource("cancellations");
    setRecords(result);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleFieldChange = (recordId, field, value) => {
    setRecords((current) =>
      current.map((record) => (record.id === recordId ? { ...record, [field]: value } : record))
    );
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => {
      if (name === "modeType") {
        return {
          modeType: value,
          originLocationId: "",
          destinationLocationId: ""
        };
      }

      return { ...current, [name]: value };
    });
  };

  const handleSave = async (record) => {
    try {
      setError("");
      setSavingId(record.id);
      await upsertAdminResource("cancellations", {
        id: record.id,
        bookingId: record.bookingId,
        refundAmount: record.refundAmount,
        refundStatus: record.refundStatus,
        reason: record.reason
      });
      await loadRecords();
    } catch (saveError) {
      setError(saveError.message || "Unable to update reimbursement details.");
    } finally {
      setSavingId(null);
    }
  };

  const modeOptions = useMemo(
    () =>
      Array.from(new Set(records.map((record) => String(record.modeType || "").trim()).filter(Boolean))).sort(),
    [records]
  );

  const originOptions = useMemo(() => {
    const visibleOrigins = records.filter((record) => {
      const modeMatches = !filters.modeType || String(record.modeType) === String(filters.modeType);
      const destinationMatches =
        !filters.destinationLocationId || String(record.destinationLocationId) === String(filters.destinationLocationId);
      return modeMatches && destinationMatches;
    });

    return visibleOrigins
      .reduce((options, record) => {
        if (!record.originLocationId || !record.origin) {
          return options;
        }

        if (!options.some((option) => option.value === String(record.originLocationId))) {
          options.push({ value: String(record.originLocationId), label: record.origin });
        }

        return options;
      }, [])
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [filters.destinationLocationId, filters.modeType, records]);

  const destinationOptions = useMemo(() => {
    const visibleDestinations = records.filter((record) => {
      const modeMatches = !filters.modeType || String(record.modeType) === String(filters.modeType);
      const originMatches =
        !filters.originLocationId || String(record.originLocationId) === String(filters.originLocationId);
      return modeMatches && originMatches;
    });

    return visibleDestinations
      .reduce((options, record) => {
        if (!record.destinationLocationId || !record.destination) {
          return options;
        }

        if (!options.some((option) => option.value === String(record.destinationLocationId))) {
          options.push({ value: String(record.destinationLocationId), label: record.destination });
        }

        return options;
      }, [])
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [filters.modeType, filters.originLocationId, records]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const modeMatches = !filters.modeType || String(record.modeType) === String(filters.modeType);
      const originMatches =
        !filters.originLocationId || String(record.originLocationId) === String(filters.originLocationId);
      const destinationMatches =
        !filters.destinationLocationId || String(record.destinationLocationId) === String(filters.destinationLocationId);
      const searchMatches =
        !query ||
        [
          record.id,
          record.bookingId,
          record.bookedByName,
          record.bookedByDisplayId,
          record.passengerNames.join(", "),
          record.route,
          record.reason,
          record.refundStatus,
          record.refundAmount,
          record.modeType,
          record.origin,
          record.destination,
          record.pnr
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return modeMatches && originMatches && destinationMatches && searchMatches;
    });
  }, [filters.destinationLocationId, filters.modeType, filters.originLocationId, records, searchTerm]);

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Cancellations</h1>
          <p>Track cancelled bookings, passenger details, booking user IDs, reimbursement amount, and refund status.</p>
        </div>
      </div>
      <div className="panel admin-cancellations-panel">
        {error && <p className="error-text">{error}</p>}

        <div className="admin-cancellations-toolbar">
          <input
            type="text"
            placeholder="Search cancellations"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select name="modeType" value={filters.modeType} onChange={handleFilterChange}>
            <option value="">All Modes</option>
            {modeOptions.map((mode) => (
              <option key={mode} value={mode}>
                {formatModeLabel(mode)}
              </option>
            ))}
          </select>
          <select name="originLocationId" value={filters.originLocationId} onChange={handleFilterChange}>
            <option value="">All Origins</option>
            {originOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select name="destinationLocationId" value={filters.destinationLocationId} onChange={handleFilterChange}>
            <option value="">All Destinations</option>
            {destinationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrap admin-cancellations-table-wrap">
          <table className="admin-cancellations-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Booking</th>
                <th>Passenger / User</th>
                <th>Mode / Route</th>
                <th>Cancelled On</th>
                <th>Reimbursement</th>
                <th>Refund Status</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>
                    <div className="table-cell-stack">
                      <strong>#{record.bookingId}</strong>
                      <span>PNR: {record.pnr || "-"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <strong>{record.bookedByName || "-"}</strong>
                      <span>{record.bookedByDisplayId || "-"}</span>
                      <span>{record.passengerNames.join(", ") || "-"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <strong>{formatModeLabel(record.modeType) || "-"}</strong>
                      <span>{record.route || record.travelName || "-"}</span>
                    </div>
                  </td>
                  <td>{formatDate(record.cancellationDate)}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={record.refundAmount}
                      onChange={(event) => handleFieldChange(record.id, "refundAmount", event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={record.refundStatus}
                      onChange={(event) => handleFieldChange(record.id, "refundStatus", event.target.value)}
                    >
                      <option value="Initiated">Initiated</option>
                      <option value="Processing">Processing</option>
                      <option value="Reimbursed">Reimbursed</option>
                    </select>
                  </td>
                  <td className="admin-cancellations-table__reason">
                    <textarea
                      value={record.reason || ""}
                      onChange={(event) => handleFieldChange(record.id, "reason", event.target.value)}
                      placeholder="Cancellation reason"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={savingId === record.id}
                      onClick={() => handleSave(record)}
                    >
                      {savingId === record.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default AdminCancellationsPage;


