// src/routes/user.routes.js
const express = require("express");
const router = express.Router();
const {
  registerUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
} = require("../controllers/user.controller");

// --- Маршруты CRUD
router.post("/", registerUser); // POST /api/users
router.get("/", getUsers); // GET /api/users
router.get("/:id", getUser); // GET /api/users/:id
router.put("/:id", updateUser); // PUT /api/users/:id
router.delete("/:id", deleteUser); // DELETE /api/users/:id

module.exports = router;
