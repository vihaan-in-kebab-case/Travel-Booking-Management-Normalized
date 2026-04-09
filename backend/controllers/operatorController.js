const { successResponse, errorResponse } = require("../utils/response");
const {
  createOperator,
  getAllOperators,
  getOperatorById,
  updateOperator,
  deleteOperator
} = require("../models/operatorModel");

// Create Operator
const addOperator = async (req, res) => {
  try {
    const { operator_name, mode_id, contact_email, contact_phone } = req.body;

    if (!operator_name || !mode_id || !contact_email || !contact_phone) {
      return errorResponse(res, "All fields are required", 400);
    }

    const insertedId = await createOperator({
      operator_name,
      mode_id,
      contact_email,
      contact_phone
    });

    const newOperator = await getOperatorById(insertedId);

    return successResponse(res, "Operator added successfully", newOperator, 201);
  } catch (error) {
    console.error("Add Operator Error:", error);
    return errorResponse(res, "Server error while adding operator", 500);
  }
};

// Get All Operators
const fetchOperators = async (req, res) => {
  try {
    const search = req.query.search || "";
    const operators = await getAllOperators(search);

    return successResponse(res, "Operators fetched successfully", operators);
  } catch (error) {
    console.error("Fetch Operators Error:", error);
    return errorResponse(res, "Server error while fetching operators", 500);
  }
};

// Get Single Operator
const fetchOperatorById = async (req, res) => {
  try {
    const { id } = req.params;
    const operator = await getOperatorById(id);

    if (!operator) {
      return errorResponse(res, "Operator not found", 404);
    }

    return successResponse(res, "Operator fetched successfully", operator);
  } catch (error) {
    console.error("Fetch Operator Error:", error);
    return errorResponse(res, "Server error while fetching operator", 500);
  }
};

// Update Operator
const editOperator = async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_name, mode_id, contact_email, contact_phone } = req.body;

    if (!operator_name || !mode_id || !contact_email || !contact_phone) {
      return errorResponse(res, "All fields are required", 400);
    }

    const exists = await getOperatorById(id);
    if (!exists) {
      return errorResponse(res, "Operator not found", 404);
    }

    await updateOperator(id, {
      operator_name,
      mode_id,
      contact_email,
      contact_phone
    });

    const updatedOperator = await getOperatorById(id);

    return successResponse(res, "Operator updated successfully", updatedOperator);
  } catch (error) {
    console.error("Update Operator Error:", error);
    return errorResponse(res, "Server error while updating operator", 500);
  }
};

// Delete Operator
const removeOperator = async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await getOperatorById(id);
    if (!exists) {
      return errorResponse(res, "Operator not found", 404);
    }

    await deleteOperator(id);

    return successResponse(res, "Operator deleted successfully");
  } catch (error) {
    console.error("Delete Operator Error:", error);
    return errorResponse(res, "Server error while deleting operator", 500);
  }
};

module.exports = {
  addOperator,
  fetchOperators,
  fetchOperatorById,
  editOperator,
  removeOperator
};