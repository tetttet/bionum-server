const express = require("express");
const router = express.Router();

const {
  register,
  login,
  update,
  deleteAccount,
  verifyToken,
  sendResetCode,
  verifyResetCode,
  resetPassword,
} = require("../controllers/auth.controller");

const { authMiddleware } = require("../middleware/auth.middleware");

// --- Регистрация и вход
router.post("/register", register);
router.post("/login", login);
router.patch("/update", authMiddleware, update);
router.delete("/delete", authMiddleware, deleteAccount);

// --- Проверка токена
router.get("/verify", authMiddleware, verifyToken);

// --- Forgot password
router.post("/forgot-password/send-code", sendResetCode);
router.post("/forgot-password/verify-code", verifyResetCode);
router.post("/forgot-password/reset-password", resetPassword);

module.exports = router;
