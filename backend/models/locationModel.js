const db = require("../config/db");

// Create Location
const createLocation = async ({ location_name, city, state, location_type }) => {
  const [result] = await db.execute(
    `INSERT INTO location (location_name, city, state, location_type)
     VALUES (?, ?, ?, ?)`,
    [location_name, city, state, location_type]
  );

  return result.insertId;
};

// Get All Locations (with search)
const getAllLocations = async (search = "") => {
  let query = `
    SELECT 
      location_id,
      location_name,
      city,
      state,
      location_type
    FROM location
  `;

  let params = [];

  if (search) {
    query += `
      WHERE 
        location_name LIKE ? OR
        city LIKE ? OR
        state LIKE ? OR
        location_type LIKE ?
    `;
    params = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
  }

  query += ` ORDER BY location_id DESC`;

  const [rows] = await db.execute(query, params);
  return rows;
};

// Get Location by ID
const getLocationById = async (id) => {
  const [rows] = await db.execute(
    `SELECT * FROM location WHERE location_id = ?`,
    [id]
  );

  return rows[0];
};

// Update Location
const updateLocation = async (id, { location_name, city, state, location_type }) => {
  const [result] = await db.execute(
    `UPDATE location
     SET location_name = ?, city = ?, state = ?, location_type = ?
     WHERE location_id = ?`,
    [location_name, city, state, location_type, id]
  );

  return result.affectedRows;
};

// Delete Location
const deleteLocation = async (id) => {
  const [result] = await db.execute(
    `DELETE FROM location WHERE location_id = ?`,
    [id]
  );

  return result.affectedRows;
};

module.exports = {
  createLocation,
  getAllLocations,
  getLocationById,
  updateLocation,
  deleteLocation
};