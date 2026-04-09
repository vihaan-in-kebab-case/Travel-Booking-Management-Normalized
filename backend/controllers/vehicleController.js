const { successResponse, errorResponse } = require("../utils/response");
const {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle
} = require("../models/vehicleModel");

// Add Vehicle
const addVehicle = async (req, res) => {
  try {
    const {
      mode_id,
      operator_id,
      vehicle_number,
      vehicle_name,
      total_seats,
      status
    } = req.body;

    if (!mode_id || !operator_id || !vehicle_number || !vehicle_name || !total_seats || !status) {
      return errorResponse(res, "All fields are required", 400);
    }

    const insertedId = await createVehicle({
      mode_id,
      operator_id,
      vehicle_number,
      vehicle_name,
      total_seats,
      status
    });

    const newVehicle = await getVehicleById(insertedId);

    return successResponse(res, "Vehicle added successfully", newVehicle, 201);
  } catch (error) {
    console.error("Add Vehicle Error:", error);
    return errorResponse(res, "Server error while adding vehicle", 500);
  }
};

// Get All Vehicles
const fetchVehicles = async (req, res) => {
  try {
    const search = req.query.search || "";
    const vehicles = await getAllVehicles(search);

    return successResponse(res, "Vehicles fetched successfully", vehicles);
  } catch (error) {
    console.error("Fetch Vehicles Error:", error);
    return errorResponse(res, "Server error while fetching vehicles", 500);
  }
};

// Get Single Vehicle
const fetchVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await getVehicleById(id);

    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }

    return successResponse(res, "Vehicle fetched successfully", vehicle);
  } catch (error) {
    console.error("Fetch Vehicle Error:", error);
    return errorResponse(res, "Server error while fetching vehicle", 500);
  }
};

// Update Vehicle
const editVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      mode_id,
      operator_id,
      vehicle_number,
      vehicle_name,
      total_seats,
      status
    } = req.body;

    if (!mode_id || !operator_id || !vehicle_number || !vehicle_name || !total_seats || !status) {
      return errorResponse(res, "All fields are required", 400);
    }

    const exists = await getVehicleById(id);
    if (!exists) {
      return errorResponse(res, "Vehicle not found", 404);
    }

    await updateVehicle(id, {
      mode_id,
      operator_id,
      vehicle_number,
      vehicle_name,
      total_seats,
      status
    });

    const updated = await getVehicleById(id);

    return successResponse(res, "Vehicle updated successfully", updated);
  } catch (error) {
    console.error("Update Vehicle Error:", error);
    return errorResponse(res, "Server error while updating vehicle", 500);
  }
};

// Delete Vehicle
const removeVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await getVehicleById(id);
    if (!exists) {
      return errorResponse(res, "Vehicle not found", 404);
    }

    await deleteVehicle(id);

    return successResponse(res, "Vehicle deleted successfully");
  } catch (error) {
    console.error("Delete Vehicle Error:", error);
    return errorResponse(res, "Server error while deleting vehicle", 500);
  }
};

module.exports = {
  addVehicle,
  fetchVehicles,
  fetchVehicleById,
  editVehicle,
  removeVehicle
};