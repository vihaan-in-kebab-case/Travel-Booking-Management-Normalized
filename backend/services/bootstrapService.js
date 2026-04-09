const bcrypt = require("bcryptjs");
const { withTransaction, execute } = require("../config/db");

async function ensureDefaultAdmin() {
  const adminUserId = String(process.env.DEFAULT_ADMIN_USER_ID || "A001").trim().toUpperCase();
  const adminName = process.env.DEFAULT_ADMIN_NAME || "System Admin";
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@travelhub.com";
  const adminPhone = process.env.DEFAULT_ADMIN_PHONE || "9999999999";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  const hashedAdminPassword = bcrypt.hashSync(adminPassword, 10);

  return withTransaction(async (connection) => {
    const existingAdmin = await execute(
      connection,
      `SELECT user_id
         FROM users
        WHERE user_id = :user_id
           OR LOWER(email) = LOWER(:email)`,
      {
        user_id: adminUserId,
        email: adminEmail
      }
    );

    if (existingAdmin.rows.length) {
      return false;
    }

    await execute(
      connection,
      `INSERT INTO users (user_id, full_name, email, phone, password, role, status)
         VALUES (:user_id, :full_name, :email, :phone, :password, 'admin', 'active')`,
      {
        user_id: adminUserId,
        full_name: adminName,
        email: adminEmail,
        phone: adminPhone,
        password: hashedAdminPassword
      }
    );

    return true;
  });
}

module.exports = {
  ensureDefaultAdmin
};
