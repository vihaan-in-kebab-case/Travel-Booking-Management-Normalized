import { useEffect, useMemo, useState } from "react";
import { validateSearchFilters } from "../utils/formValidation";
import { getTravelSearchOptions } from "../services/travelService";

const defaultState = {
  type: "",
  origin: "",
  destination: "",
  departureDate: ""
};

const defaultOptions = {
  modes: [],
  locations: []
};

function SearchForm({ onSearch, initialValues = defaultState, compact = false }) {
  const [form, setForm] = useState(initialValues);
  const [options, setOptions] = useState(defaultOptions);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((current) => ({ ...defaultState, ...current, ...initialValues }));
    setError("");
  }, [initialValues]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const result = await getTravelSearchOptions();
        setOptions(result);
      } catch (loadError) {
        setError(loadError.message || "Unable to load travel search options.");
      }
    };

    loadOptions();
  }, []);

  const filteredLocationOptions = useMemo(
    () => options.locations.filter((option) => !form.type || option.mode_types.includes(form.type)),
    [form.type, options.locations]
  );

  const originOptions = useMemo(
    () => filteredLocationOptions.filter((option) => String(option.value) !== String(form.destination) || String(option.value) === String(form.origin)),
    [filteredLocationOptions, form.destination, form.origin]
  );

  const destinationOptions = useMemo(
    () => filteredLocationOptions.filter((option) => String(option.value) !== String(form.origin) || String(option.value) === String(form.destination)),
    [filteredLocationOptions, form.destination, form.origin]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => {
      const nextForm = { ...current, [name]: value };

      if (name === "type") {
        const allowedIds = new Set(
          options.locations
            .filter((option) => !value || option.mode_types.includes(value))
            .map((option) => String(option.value))
        );

        if (!allowedIds.has(String(current.origin))) {
          nextForm.origin = "";
        }

        if (!allowedIds.has(String(current.destination))) {
          nextForm.destination = "";
        }
      }

      if (name === "origin" && String(value) === String(current.destination)) {
        nextForm.destination = "";
      }

      if (name === "destination" && String(value) === String(current.origin)) {
        nextForm.origin = "";
      }

      return nextForm;
    });

    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationError = validateSearchFilters(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    onSearch(form);
  };

  return (
    <form className={`search-form ${compact ? "compact" : ""}`} onSubmit={handleSubmit}>
      {error && <p className="error-text">{error}</p>}
      <select name="type" value={form.type} onChange={handleChange}>
        <option value="">All Modes</option>
        {options.modes.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select name="origin" value={form.origin} onChange={handleChange}>
        <option value="">From</option>
        {originOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select name="destination" value={form.destination} onChange={handleChange}>
        <option value="">To</option>
        {destinationOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="departureDate"
        value={form.departureDate}
        onChange={handleChange}
      />
      <button type="submit" className="primary-button search-form__button">
        Book
      </button>
    </form>
  );
}

export default SearchForm;
