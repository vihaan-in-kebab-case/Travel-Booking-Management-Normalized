const express = require("express");
const router = express.Router();
const {
  fetchAdminOverview,
  fetchAdminResource,
  saveAdminResource,
  removeAdminResource,
  fetchVehicleOptions,
  fetchRouteOptions
} = require("../controllers/adminController");
const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

router.use(protect, allowRoles("admin"));

router.get("/overview", fetchAdminOverview);
router.get("/form-options/vehicles", fetchVehicleOptions);
router.get("/form-options/routes", fetchRouteOptions);
router.get("/:resourceKey", fetchAdminResource);
router.post("/:resourceKey", saveAdminResource);
router.delete("/:resourceKey/:recordId", removeAdminResource);

module.exports = router;
