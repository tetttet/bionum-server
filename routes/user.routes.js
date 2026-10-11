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

const { authMiddleware } = require('../middleware/auth.middleware');
const { createAdminGuard } = require('../middleware/admin.middleware');
const pool = require('../config/db');
const ownAccount = (req,res,next) => String(req.user.id) === req.params.id ? next() : res.status(403).json({error:'Forbidden'});
// --- Маршруты CRUD
router.post("/", registerUser); // POST /api/users
router.get("/", authMiddleware, createAdminGuard(pool), getUsers); // GET /api/users
router.get("/:id", authMiddleware, ownAccount, getUser); // GET /api/users/:id
router.put("/:id", authMiddleware, ownAccount, updateUser); // PUT /api/users/:id
router.delete("/:id", authMiddleware, ownAccount, deleteUser); // DELETE /api/users/:id

module.exports = router;
