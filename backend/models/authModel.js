const bcrypt = require("bcryptjs");
const { execute, normalizeRow, withConnection, withTransaction } = require("../config/db");

async function findUserByEmail(email) {
  return withConnection(async (connection) => {
    const result = await execute(
      connection,
      `SELECT user_id, full_name, email, phone, password, role, status
         FROM users
        WHERE LOWER(email) = LOWER(:email)`,
      { email }
    );

    return result.rows.length ? normalizeRow(result.rows[0]) : null;
  });
}

async function findUserById(userId) {
  return withConnection(async (connection) => {
    const result = await execute(
      connection,
      `SELECT user_id, full_name, email, phone, password, role, status
         FROM users
        WHERE user_id = :user_id`,
      { user_id: userId }
    );

    return result.rows.length ? normalizeRow(result.rows[0]) : null;
  });
}

async function createUser({ requested_user_id, full_name, email, phone, password, role = "user" }) {
  return withTransaction(async (connection) => {
    const hashedPassword = bcrypt.hashSync(password, 10);

    await execute(
      connection,
      `INSERT INTO users (user_id, full_name, email, phone, password, role)
       VALUES (:requested_user_id, :full_name, :email, :phone, :password, :role)`,
      {
        requested_user_id,
        full_name,
        email,
        phone,
        password: hashedPassword,
        role
      }
    );

    return requested_user_id;
  });
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser
};
