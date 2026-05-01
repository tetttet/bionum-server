// src/controllers/user.controller.js
const bcrypt = require("bcryptjs");
const {
  createUser,
  getAllUsers,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
} = require("../models/user.model");
const { normalizeDateOnly } = require("../utils/dateOnly");

// --- Создать нового пользователя
exports.registerUser = async (req, res) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      email,
      password,
    } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedDateOfBirth = normalizeDateOnly(date_of_birth);

    const newUser = await createUser({
      first_name,
      middle_name,
      last_name,
      date_of_birth: normalizedDateOfBirth,
      email,
      password: hashedPassword,
    });

    res.status(201).json(newUser);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Получить всех пользователей
exports.getUsers = async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Получить одного пользователя по ID
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Обновить данные пользователя
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(fields, "date_of_birth")) {
      fields.date_of_birth = normalizeDateOnly(fields.date_of_birth);
    }

    // Если обновляют пароль — хэшируем
    if (fields.password) {
      fields.password = await bcrypt.hash(fields.password, 10);
    }

    const updatedUser = await updateUser(id, fields);

    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Удалить пользователя
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteUser(id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
