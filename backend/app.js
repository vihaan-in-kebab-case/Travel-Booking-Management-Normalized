const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes");
const travelRoutes = require("./routes/travelRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Travel booking Oracle backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/travels", travelRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);

app.use((error, req, res, next) => {
  console.error("Unhandled Error:", error);
  res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
