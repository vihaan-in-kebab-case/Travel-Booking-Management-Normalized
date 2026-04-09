const express = require("express");
const router = express.Router();
const { fetchTravels, fetchTravelById, fetchTravelSearchOptions } = require("../controllers/travelController");

router.get("/", fetchTravels);
router.get("/search-options", fetchTravelSearchOptions);
router.get("/:id", fetchTravelById);

module.exports = router;
