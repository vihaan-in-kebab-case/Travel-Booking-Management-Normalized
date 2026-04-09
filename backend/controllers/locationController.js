const { successResponse, errorResponse } = require("../utils/response");
const {
  createLocation,
  getAllLocations,
  getLocationById,
  updateLocation,
  deleteLocation
} = require("../models/locationModel");

// Add Location
const addLocation = async (req, res) => {
  try {
    const { location_name, city, state, location_type } = req.body;

    if (!location_name || !city || !state || !location_type) {
      return errorResponse(res, "All fields are required", 400);
    }

    const insertedId = await createLocation({
      location_name,
      city,
      state,
      location_type
    });

    const newLocation = await getLocationById(insertedId);

    return successResponse(res, "Location added successfully", newLocation, 201);
  } catch (error) {
    console.error("Add Location Error:", error);
    return errorResponse(res, "Server error while adding location", 500);
  }
};

// Get All Locations
const fetchLocations = async (req, res) => {
  try {
    const search = req.query.search || "";
    const locations = await getAllLocations(search);

    return successResponse(res, "Locations fetched successfully", locations);
  } catch (error) {
    console.error("Fetch Locations Error:", error);
    return errorResponse(res, "Server error while fetching locations", 500);
  }
};

// Get Single Location
const fetchLocationById = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await getLocationById(id);

    if (!location) {
      return errorResponse(res, "Location not found", 404);
    }

    return successResponse(res, "Location fetched successfully", location);
  } catch (error) {
    console.error("Fetch Location Error:", error);
    return errorResponse(res, "Server error while fetching location", 500);
  }
};

// Update Location
const editLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { location_name, city, state, location_type } = req.body;

    if (!location_name || !city || !state || !location_type) {
      return errorResponse(res, "All fields are required", 400);
    }

    const exists = await getLocationById(id);
    if (!exists) {
      return errorResponse(res, "Location not found", 404);
    }

    await updateLocation(id, {
      location_name,
      city,
      state,
      location_type
    });

    const updated = await getLocationById(id);

    return successResponse(res, "Location updated successfully", updated);
  } catch (error) {
    console.error("Update Location Error:", error);
    return errorResponse(res, "Server error while updating location", 500);
  }
};

// Delete Location
const removeLocation = async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await getLocationById(id);
    if (!exists) {
      return errorResponse(res, "Location not found", 404);
    }

    await deleteLocation(id);

    return successResponse(res, "Location deleted successfully");
  } catch (error) {
    console.error("Delete Location Error:", error);
    return errorResponse(res, "Server error while deleting location", 500);
  }
};

module.exports = {
  addLocation,
  fetchLocations,
  fetchLocationById,
  editLocation,
  removeLocation
};