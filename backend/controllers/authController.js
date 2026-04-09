const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const {
  findUserByEmail,
  findUserById,
  createUser
} = require("../models/authModel");

function normalizeUserId(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidUserId(value) {
  return /^[A-Z][A-Z0-9]*$/.test(value);
}

function mapUser(user) {
  return {
    user_id: user.user_id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    display_user_id: user.user_id
  };
}

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function registerUser(req, res) {
  try {
    const { user_id, full_name, email, phone, password } = req.body;
    const normalizedUserId = normalizeUserId(user_id);

    if (!normalizedUserId || !full_name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidUserId(normalizedUserId)) {
      return res.status(400).json({ message: "User ID must be alphanumeric and start with a letter" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Account already exists for this email" });
    }

    const insertedId = await createUser({
      requested_user_id: normalizedUserId,
      full_name,
      email,
      phone,
      password,
      role: "user"
    });

    const user = await findUserById(insertedId);
    return res.status(201).json({ token: generateToken(user), user: mapUser(user) });
  } catch (error) {
    console.error("Register Error:", error);
    if (error.errorNum === 1) {
      return res.status(400).json({ message: "This email, phone, or user ID is already in use" });
    }

    return res.status(500).json({
      message: error.message || "Server error during registration"
    });
  }
}

async function login(req, res) {
  try {
    const { user_id, password, expectedRole } = req.body;
    const normalizedUserId = normalizeUserId(user_id);

    if (!normalizedUserId || !password) {
      return res.status(400).json({ message: "User ID and password are required" });
    }

    const user = await findUserById(normalizedUserId);

    if (!user) {
      return res.status(401).json({ message: "Invalid user ID or password" });
    }

    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        message: expectedRole === "admin"
          ? "Use the user login for customer bookings"
          : "Use the admin login for administrative access"
      });
    }

    const passwordMatches = isBcryptHash(user.password)
      ? bcrypt.compareSync(password, user.password)
      :password === user.password;

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid user ID or password" });
    }

    return res.json({ token: generateToken(user), user: mapUser(user) });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
}

async function getProfile(req, res) {
  try {
    const user = await findUserById(req.user.user_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(mapUser(user));
  } catch (error) {
    console.error("Profile Error:", error);
    return res.status(500).json({ message: "Server error while fetching profile" });
  }
}

module.exports = {
  registerUser,
  login,
  getProfile
};
