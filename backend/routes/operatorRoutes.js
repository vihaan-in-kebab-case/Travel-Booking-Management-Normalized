const express = require("express");
const router = express.Router();

const {
  addOperator,
  fetchOperators,
  fetchOperatorById,
  editOperator,
  removeOperator
} = require("../controllers/operatorController");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// Only admin should manage operators
router.post("/", protect, allowRoles("admin"), addOperator);
router.get("/", protect, allowRoles("admin"), fetchOperators);
router.get("/:id", protect, allowRoles("admin"), fetchOperatorById);
router.put("/:id", protect, allowRoles("admin"), editOperator);
router.delete("/:id", protect, allowRoles("admin"), removeOperator);

module.exports = router;