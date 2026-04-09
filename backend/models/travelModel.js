const db = require("../config/db");

const getAllTravelModes = async () => {
  const [rows] = await db.execute(
    `SELECT mode_id, mode_name FROM travel_mode ORDER BY mode_id ASC`
  );
  return rows;
};

module.exports = { getAllTravelModes };