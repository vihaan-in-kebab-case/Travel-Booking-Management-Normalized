const db = require("../config/db");

// Create Operator
const createOperator = async ({ operator_name, mode_id, contact_email, contact_phone }) => {
  const [result] = await db.execute(
    `INSERT INTO operator (operator_name, mode_id, contact_email, contact_phone)
     VALUES (?, ?, ?, ?)`,
    [operator_name, mode_id, contact_email, contact_phone]
  );

  return result.insertId;
};

// Get All Operators
const getAllOperators = async (search = "") => {
  let query = `
    SELECT 
      o.operator_id,
      o.operator_name,
      o.mode_id,
      tm.mode_name,
      o.contact_email,
      o.contact_phone
    FROM operator o
    JOIN travel_mode tm ON o.mode_id = tm.mode_id
  `;

  let params = [];

  if (search) {
    query += `
      WHERE 
        o.operator_name LIKE ? OR
        tm.mode_name LIKE ? OR
        o.contact_email LIKE ? OR
        o.contact_phone LIKE ?
    `;
    params = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
  }

  query += ` ORDER BY o.operator_id DESC`;

  const [rows] = await db.execute(query, params);
  return rows;
};

// Get Operator By ID
const getOperatorById = async (operator_id) => {
  const [rows] = await db.execute(
    `SELECT 
      o.operator_id,
      o.operator_name,
      o.mode_id,
      tm.mode_name,
      o.contact_email,
      o.contact_phone
     FROM operator o
     JOIN travel_mode tm ON o.mode_id = tm.mode_id
     WHERE o.operator_id = ?`,
    [operator_id]
  );

  return rows[0];
};

// Update Operator
const updateOperator = async (operator_id, { operator_name, mode_id, contact_email, contact_phone }) => {
  const [result] = await db.execute(
    `UPDATE operator
     SET operator_name = ?, mode_id = ?, contact_email = ?, contact_phone = ?
     WHERE operator_id = ?`,
    [operator_name, mode_id, contact_email, contact_phone, operator_id]
  );

  return result.affectedRows;
};

// Delete Operator
const deleteOperator = async (operator_id) => {
  const [result] = await db.execute(
    `DELETE FROM operator WHERE operator_id = ?`,
    [operator_id]
  );

  return result.affectedRows;
};

module.exports = {
  createOperator,
  getAllOperators,
  getOperatorById,
  updateOperator,
  deleteOperator
};