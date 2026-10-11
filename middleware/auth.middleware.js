const jwt = require("jsonwebtoken");
const { getUserById } = require("../models/user.model");
const JWT_SECRET = process.env.JWT_SECRET;

exports.authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.authExpiresAt = decoded.exp;
    req.user = user; // прикрепляем пользователя к запросу
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
