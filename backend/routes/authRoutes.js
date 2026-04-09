const express = require("express");
const router = express.Router();
const { registerUser, login, getProfile } = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/login", login);
router.post("/login/user", login);
router.post("/login/admin", login);
router.get("/profile", protect, getProfile);

module.exports = router;
