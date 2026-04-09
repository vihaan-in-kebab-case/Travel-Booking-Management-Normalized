const {
  getAdminOverview,
  getAdminResource,
  getVehicleFormOptions,
  getRouteFormOptions,
  upsertAdminResource,
  deleteAdminResource
} = require("../services/travelDataService");

async function fetchAdminOverview(req, res) {
  try {
    const overview = await getAdminOverview();
    res.json(overview);
  } catch (error) {
    console.error("Admin Overview Error:", error);
    res.status(500).json({ message: "Unable to fetch admin overview" });
  }
}

async function fetchAdminResource(req, res) {
  try {
    const records = await getAdminResource(req.params.resourceKey);
    res.json(records);
  } catch (error) {
    console.error("Admin Resource Fetch Error:", error);
    res.status(500).json({ message: error.message || "Unable to fetch admin resource" });
  }
}

async function saveAdminResource(req, res) {
  try {
    const record = await upsertAdminResource(req.params.resourceKey, req.body);
    res.status(201).json(record);
  } catch (error) {
    console.error("Admin Resource Save Error:", error);
    res.status(500).json({ message: error.message || "Unable to save admin resource" });
  }
}

async function removeAdminResource(req, res) {
  try {
    const result = await deleteAdminResource(req.params.resourceKey, req.params.recordId);
    res.json(result);
  } catch (error) {
    console.error("Admin Resource Delete Error:", error);
    res.status(500).json({ message: error.message || "Unable to delete admin resource" });
  }
}

async function fetchVehicleOptions(req, res) {
  try {
    const options = await getVehicleFormOptions();
    res.json(options);
  } catch (error) {
    console.error("Vehicle Form Options Error:", error);
    res.status(500).json({ message: "Unable to fetch vehicle form options" });
  }
}

async function fetchRouteOptions(req, res) {
  try {
    const options = await getRouteFormOptions();
    res.json(options);
  } catch (error) {
    console.error("Route Form Options Error:", error);
    res.status(500).json({ message: "Unable to fetch route form options" });
  }
}

module.exports = {
  fetchAdminOverview,
  fetchAdminResource,
  saveAdminResource,
  removeAdminResource,
  fetchVehicleOptions,
  fetchRouteOptions
};
