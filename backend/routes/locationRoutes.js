const express = require("express");
const router = express.Router();

const {
  addLocation,
  fetchLocations,
  fetchLocationById,
  editLocation,
  removeLocation
} = require("../controllers/locationController");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// Admin only
router.post("/", protect, allowRoles("admin"), addLocation);
router.get("/", protect, allowRoles("admin"), fetchLocations);
router.get("/:id", protect, allowRoles("admin"), fetchLocationById);
router.put("/:id", protect, allowRoles("admin"), editLocation);
router.delete("/:id", protect, allowRoles("admin"), removeLocation);

module.exports = router;