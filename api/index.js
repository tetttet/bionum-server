require("dotenv").config();
require("../src/config/db");

const express = require("express");
const cors = require("cors");

const { initUserTable } = require("../src/models/user.model");
const { initPasswordResetTable } = require("../src/models/password_reset.model");

// Роуты
const userRoutes = require("../src/routes/user.routes");
const authRoutes = require("../src/routes/auth.routes");
const subscriptionsRoutes = require("../src/routes/subscriptions.routes");
const webhookEventsRoutes = require("../src/routes/webhook_events.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Инициализация таблиц один раз на cold start function
const initPromise = Promise.all([
  initUserTable(),
  initPasswordResetTable(),
]);

app.use(async (req, res, next) => {
  try {
    await initPromise;
    next();
  } catch (error) {
    console.error("❌ Init error:", error);
    return res.status(500).json({ error: "Server initialization failed" });
  }
});

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/webhook-events", webhookEventsRoutes);

app.get("/", (req, res) => {
  res.status(200).json({ message: "API is running" });
});

module.exports = app;