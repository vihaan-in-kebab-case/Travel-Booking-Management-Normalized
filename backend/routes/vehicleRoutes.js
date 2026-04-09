const express = require("express");
const router = express.Router();

const {
  addVehicle,
  fetchVehicles,
  fetchVehicleById,
  editVehicle,
  removeVehicle
} = require("../controllers/vehicleController");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// Admin only
router.post("/", protect, allowRoles("admin"), addVehicle);
router.get("/", protect, allowRoles("admin"), fetchVehicles);
router.get("/:id", protect, allowRoles("admin"), fetchVehicleById);
router.put("/:id", protect, allowRoles("admin"), editVehicle);
router.delete("/:id", protect, allowRoles("admin"), removeVehicle);

module.exports = router;