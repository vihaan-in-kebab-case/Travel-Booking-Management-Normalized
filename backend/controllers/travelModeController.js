const { successResponse, errorResponse } = require("../utils/response");
const { getAllTravelModes } = require("../models/travelModeModel");

const fetchTravelModes = async (req, res) => {
  try {
    const modes = await getAllTravelModes();
    return successResponse(res, "Travel modes fetched successfully", modes);
  } catch (error) {
    console.error("Fetch Travel Modes Error:", error);
    return errorResponse(res, "Server error while fetching travel modes", 500);
  }
};

module.exports = { fetchTravelModes };