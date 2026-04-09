import { useEffect, useMemo, useState } from "react";
import {
  deleteAdminResource,
  getAdminResource,
  getRouteFormOptions,
  upsertAdminResource
} from "../../services/travelService";
import { validateRouteForm } from "../../utils/formValidation";
import { formatDateTime } from "../../utils/dateTime";

const defaultStop = {
  location_id: "",
  arrivalDateTime: "",
  departureDateTime: ""
};

// BCNF change: mode_id removed from route form — mode is implied by the operator.
// base_fare added — fare now lives on the schedule, not on vehicle.seat_fare.
const defaultForm = {
  origin: "",
  destination: "",
  departureDateTime: "",
  arrivalDateTime: "",
  base_fare: "",
  operator_id: "",
  vehicle_id: "",
  status: "active",
  intermediateStops: []
};

function supportsSelectedMode(option, modeType) {
  return !modeType || option.mode_types.includes(modeType);
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// BCNF change: vehicle.mode_id is gone; availability check now only uses operator_id.
function isVehicleAvailableForForm(option, form, editingId) {
  const matchesOperator = !form.operator_id || String(option.operator_id) === String(form.operator_id);

  if (!matchesOperator) {
    return false;
  }

  const departureDateTime = parseDateTime(form.departureDateTime);
  const arrivalDateTime = parseDateTime(form.arrivalDateTime);
  if (!departureDateTime || !arrivalDateTime) {
    return true;
  }

  const currentRouteId = String(editingId || "");
  return !(option.assignedSchedules || []).some((schedule) => {
    if (String(schedule.route_id) === currentRouteId) {
      return false;
    }

    const existingDeparture = parseDateTime(schedule.departureDateTime);
    const existingArrival = parseDateTime(schedule.arrivalDateTime);
    if (!existingDeparture || !existingArrival) {
      return false;
    }

    return departureDateTime < existingArrival && arrivalDateTime > existingDeparture;
  });
}

// Derive the mode type label from the selected operator so locations can be filtered.
function getModeTypeFromOperator(operatorOptions, operatorId, modeOptions) {
  const operator = operatorOptions.find((opt) => String(opt.value) === String(operatorId));
  if (!operator) return "";
  const mode = modeOptions.find((m) => String(m.value) === String(operator.mode_id));
  return String(mode?.label || "").trim().toLowerCase();
}

function AdminRoutesPage() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [modeOptions, setModeOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);

  const loadData = async () => {
    const [routeRecords, optionData] = await Promise.all([
      getAdminResource("routes"),
      getRouteFormOptions()
    ]);
    setRecords(routeRecords);
    setModeOptions(optionData.modes);
    setLocationOptions(optionData.locations);
    setOperatorOptions(optionData.operators);
    setVehicleOptions(optionData.vehicles);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Derive mode type from the selected operator (not a standalone mode_id field)
  const selectedModeType = useMemo(
    () => getModeTypeFromOperator(operatorOptions, form.operator_id, modeOptions),
    [form.operator_id, operatorOptions, modeOptions]
  );

  const filteredLocationOptions = useMemo(
    () => locationOptions.filter((option) => supportsSelectedMode(option, selectedModeType)),
    [locationOptions, selectedModeType]
  );

  // All operators shown — no mode_id filter needed on the form itself
  const filteredVehicleOptions = useMemo(() => {
    if (!form.operator_id) {
      return [];
    }

    return vehicleOptions.filter((option) => isVehicleAvailableForForm(option, form, editingId));
  }, [editingId, form, vehicleOptions]);

  const getStopLocationOptions = (index) => {
    const currentStopId = String(form.intermediateStops[index]?.location_id || "");
    const blockedIds = new Set(
      [
        form.origin,
        form.destination,
        ...form.intermediateStops
          .filter((_, stopIndex) => stopIndex !== index)
          .map((stop) => stop.location_id)
      ]
        .filter(Boolean)
        .map((value) => String(value))
    );

    return filteredLocationOptions.filter(
      (option) => String(option.value) === currentStopId || !blockedIds.has(String(option.value))
    );
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const nextForm = { ...current, [name]: value };

      // When operator changes, reset vehicle and re-filter locations by the new operator's mode
      if (name === "operator_id") {
        if (!vehicleOptions.some((option) => isVehicleAvailableForForm(option, { ...current, operator_id: value }, editingId) && String(option.value) === String(current.vehicle_id))) {
          nextForm.vehicle_id = "";
        }

        // Filter locations to those compatible with the new operator's mode
        const newModeType = getModeTypeFromOperator(operatorOptions, value, modeOptions);
        const allowedIds = new Set(
          locationOptions
            .filter((option) => supportsSelectedMode(option, newModeType))
            .map((option) => String(option.value))
        );

        if (!allowedIds.has(String(current.origin))) nextForm.origin = "";
        if (!allowedIds.has(String(current.destination))) nextForm.destination = "";
        nextForm.intermediateStops = current.intermediateStops.filter((stop) =>
          allowedIds.has(String(stop.location_id))
        );
      }

      if (name === "origin" && String(value) === String(current.destination)) {
        nextForm.destination = "";
      }

      if (name === "destination" && String(value) === String(current.origin)) {
        nextForm.origin = "";
      }

      nextForm.intermediateStops = (nextForm.intermediateStops || []).filter((stop) => {
        const stopId = String(stop.location_id || "");
        return stopId && stopId !== String(nextForm.origin || "") && stopId !== String(nextForm.destination || "");
      });

      const selectedVehicle = vehicleOptions.find((option) => String(option.value) === String(current.vehicle_id));
      if (selectedVehicle && !isVehicleAvailableForForm(selectedVehicle, nextForm, editingId)) {
        nextForm.vehicle_id = "";
      }

      return nextForm;
    });
    setError("");
  };

  const handleStopChange = (index, field, value) => {
    setForm((current) => ({
      ...current,
      intermediateStops: current.intermediateStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, [field]: value } : stop
      )
    }));
  };

  const addStop = () => {
    setForm((current) => ({
      ...current,
      intermediateStops: [...current.intermediateStops, { ...defaultStop }]
    }));
  };

  const removeStop = (index) => {
    setForm((current) => ({
      ...current,
      intermediateStops: current.intermediateStops.filter((_, stopIndex) => stopIndex !== index)
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validationError = validateRouteForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await upsertAdminResource("routes", editingId ? { ...form, id: editingId } : form);
      setForm(defaultForm);
      setEditingId(null);
      await loadData();
    } catch (submitError) {
      setError(submitError.message || "Unable to save this route.");
    }
  };

  const handleDelete = async (recordId) => {
    await deleteAdminResource("routes", recordId);
    await loadData();
  };

  const handleEdit = (record) => {
    // BCNF change: no mode_id in form; base_fare added
    setForm({
      origin: record.origin || "",
      destination: record.destination || "",
      departureDateTime: record.departureDateTime || "",
      arrivalDateTime: record.arrivalDateTime || "",
      base_fare: record.base_fare ?? "",
      operator_id: record.operator_id || "",
      vehicle_id: record.vehicle_id || "",
      status: record.status || "active",
      intermediateStops: record.intermediateStops || []
    });
    setEditingId(record.id);
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(defaultForm);
    setError("");
  };

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return records;
    }

    return records.filter((record) =>
      [
        record.mode_type,
        record.origin_name,
        record.destination_name,
        record.operator_name,
        record.vehicle_name,
        record.departureDateTime,
        record.arrivalDateTime,
        record.intermediateStops
          .map((stop) => `${stop.location_name} ${stop.arrivalDateTime} ${stop.departureDateTime}`)
          .join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [records, searchTerm]);

  return (
    <section className="page-shell route-admin-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Routes</h1>
          <p>Configure route details, linked operator, and active vehicles that do not overlap with an existing schedule.</p>
        </div>
      </div>

      <div className="admin-grid">
        <form className="panel admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Update Route" : "Add Route"}</h3>
          {error && <p className="error-text">{error}</p>}
          <div className="form-grid">
            {/* BCNF change: no standalone Mode dropdown — mode is implied by operator */}
            <select name="operator_id" value={form.operator_id} onChange={handleChange}>
              <option value="">Operator</option>
              {operatorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="origin" value={form.origin} onChange={handleChange}>
              <option value="">Origin</option>
              {filteredLocationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="destination" value={form.destination} onChange={handleChange}>
              <option value="">Destination</option>
              {filteredLocationOptions
                .filter((option) => String(option.value) !== String(form.origin) || String(option.value) === String(form.destination))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
            <input type="datetime-local" name="departureDateTime" value={form.departureDateTime} onChange={handleChange} />
            <input type="datetime-local" name="arrivalDateTime" value={form.arrivalDateTime} onChange={handleChange} />
            {/* BCNF change: base_fare now entered here on the schedule, not inherited from vehicle.seat_fare */}
            <input
              type="number"
              name="base_fare"
              placeholder="Base Fare (₹)"
              min="0"
              step="0.01"
              value={form.base_fare}
              onChange={handleChange}
            />
            <select name="vehicle_id" value={form.vehicle_id} onChange={handleChange}>
              <option value="">{form.operator_id ? "Available Vehicle" : "Select Operator First"}</option>
              {filteredVehicleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="route-admin-actions">
            <button type="submit" className="primary-button">
              {editingId ? "Update Route" : "Save Route"}
            </button>
            {editingId && (
              <button type="button" className="ghost-button" onClick={handleCancelEdit}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <div className="panel">
          <h3>Current Routes</h3>
          <input
            type="text"
            placeholder="Search routes"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Path</th>
                  <th>Operator</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Source to Destination</th>
                  <th>Stops</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.mode_type}</td>
                    <td>{record.origin_name} to {record.destination_name}</td>
                    <td>{record.operator_name || record.operator_id}</td>
                    <td>{record.vehicle_name || record.vehicle_id}</td>
                    <td>
                      <span className={`status-badge ${String(record.status || "").toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>{formatDateTime(record.departureDateTime)} to {formatDateTime(record.arrivalDateTime)}</td>
                    <td>
                      {record.intermediateStops.length
                        ? record.intermediateStops
                            .map((stop) => `${stop.location_name} (${formatDateTime(stop.arrivalDateTime)} - ${formatDateTime(stop.departureDateTime)})`)
                            .join(", ")
                        : "Direct"}
                    </td>
                    <td>
                      <button type="button" className="ghost-button" onClick={() => handleEdit(record)}>
                        Edit
                      </button>
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
        </div>
      </div>

      <div className="panel route-stops-panel route-stops-panel--full">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Intermediate Stops</p>
            <h3>Stops</h3>
            <p>These stop details are saved with the route form above.</p>
          </div>
          <button type="button" className="primary-button stop-add-button" onClick={addStop}>
            +
          </button>
        </div>

        <div className="route-stops-list">
          {form.intermediateStops.length ? (
            form.intermediateStops.map((stop, index) => (
              <div key={`${stop.location_id}-${index}`} className="route-stop-row">
                <div className="route-stop-row__header">
                  <span className="user-pill">Stop {index + 1}</span>
                  <button
                    type="button"
                    className="ghost-button danger route-stop-remove"
                    onClick={() => removeStop(index)}
                  >
                    Remove
                  </button>
                </div>
                <div className="route-stop-row__fields route-stop-row__fields--datetime">
                  <label className="route-stop-field">
                    <span>Stop Location</span>
                    <select
                      value={stop.location_id}
                      onChange={(event) => handleStopChange(index, "location_id", event.target.value)}
                    >
                      <option value="">Stop Location</option>
                      {getStopLocationOptions(index).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="route-stop-field">
                    <span>Arrival Date and Time</span>
                    <input
                      type="datetime-local"
                      value={stop.arrivalDateTime}
                      onChange={(event) => handleStopChange(index, "arrivalDateTime", event.target.value)}
                    />
                  </label>
                  <label className="route-stop-field">
                    <span>Departure Date and Time</span>
                    <input
                      type="datetime-local"
                      value={stop.departureDateTime}
                      onChange={(event) => handleStopChange(index, "departureDateTime", event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))
          ) : (
            <p className="helper-text">Add a stop to capture its location and timing details.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminRoutesPage;
