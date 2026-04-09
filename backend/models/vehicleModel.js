const db = require("../config/db");

// Create Vehicle
const createVehicle = async ({
  mode_id,
  operator_id,
  vehicle_number,
  vehicle_name,
  total_seats,
  status
}) => {
  const [result] = await db.execute(
    `INSERT INTO vehicle 
     (mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status]
  );

  return result.insertId;
};

// Get All Vehicles (with search)
const getAllVehicles = async (search = "") => {
  let query = `
    SELECT 
      v.vehicle_id,
      v.mode_id,
      tm.mode_name,
      v.operator_id,
      o.operator_name,
      v.vehicle_number,
      v.vehicle_name,
      v.total_seats,
      v.status
    FROM vehicle v
    JOIN travel_mode tm ON v.mode_id = tm.mode_id
    JOIN operator o ON v.operator_id = o.operator_id
  `;

  let params = [];

  if (search) {
    query += `
      WHERE 
        tm.mode_name LIKE ? OR
        o.operator_name LIKE ? OR
        v.vehicle_number LIKE ? OR
        v.vehicle_name LIKE ? OR
        v.status LIKE ?
    `;
    params = [
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`
    ];
  }

  query += ` ORDER BY v.vehicle_id DESC`;

  const [rows] = await db.execute(query, params);
  return rows;
};

// Get Vehicle by ID
const getVehicleById = async (id) => {
  const [rows] = await db.execute(
    `SELECT 
      v.vehicle_id,
      v.mode_id,
      tm.mode_name,
      v.operator_id,
      o.operator_name,
      v.vehicle_number,
      v.vehicle_name,
      v.total_seats,
      v.status
     FROM vehicle v
     JOIN travel_mode tm ON v.mode_id = tm.mode_id
     JOIN operator o ON v.operator_id = o.operator_id
     WHERE v.vehicle_id = ?`,
    [id]
  );

  return rows[0];
};

// Update Vehicle
const updateVehicle = async (
  id,
  { mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status }
) => {
  const [result] = await db.execute(
    `UPDATE vehicle
     SET mode_id = ?, operator_id = ?, vehicle_number = ?, vehicle_name = ?, total_seats = ?, status = ?
     WHERE vehicle_id = ?`,
    [mode_id, operator_id, vehicle_number, vehicle_name, total_seats, status, id]
  );

  return result.affectedRows;
};

// Delete Vehicle
const deleteVehicle = async (id) => {
  const [result] = await db.execute(
    `DELETE FROM vehicle WHERE vehicle_id = ?`,
    [id]
  );

  return result.affectedRows;
};

module.exports = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle
};