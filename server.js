require("dotenv").config();
require("./src/config/db");

const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 8080;

const { initUserTable } = require("./src/models/user.model");
const { initPasswordResetTable } = require("./src/models/password_reset.model");

// Роуты
const userRoutes = require("./src/routes/user.routes");
const authRoutes = require("./src/routes/auth.routes");
const subscriptionsRoutes = require("./src/routes/subscriptions.routes");
const webhookEventsRoutes = require("./src/routes/webhook_events.routes");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/webhook-events", webhookEventsRoutes);

async function startServer() {
  try {
    await initUserTable();
    await initPasswordResetTable();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀🚀🚀 Сервер работает на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server start error:", error);
    process.exit(1);
  }
}

startServer();
