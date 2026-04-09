const {
  searchTravels,
  getTravelById,
  getTravelSearchOptions
} = require("../services/travelDataService");

async function fetchTravels(req, res) {
  try {
    const travels = await searchTravels(req.query || {});
    res.json(travels);
  } catch (error) {
    console.error("Fetch Travels Error:", error);
    res.status(500).json({ message: "Unable to fetch travels" });
  }
}

async function fetchTravelById(req, res) {
  try {
    const travel = await getTravelById(req.params.id);
    if (!travel) {
      return res.status(404).json({ message: "Travel not found" });
    }

    return res.json(travel);
  } catch (error) {
    console.error("Fetch Travel By ID Error:", error);
    return res.status(500).json({ message: "Unable to fetch travel details" });
  }
}

async function fetchTravelSearchOptions(req, res) {
  try {
    const options = await getTravelSearchOptions();
    res.json(options);
  } catch (error) {
    console.error("Fetch Travel Search Options Error:", error);
    res.status(500).json({ message: "Unable to fetch travel search options" });
  }
}

module.exports = {
  fetchTravels,
  fetchTravelById,
  fetchTravelSearchOptions
};
