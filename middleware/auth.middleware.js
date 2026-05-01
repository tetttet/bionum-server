const jwt = require("jsonwebtoken");
const { getUserById } = require("../models/user.model");
const JWT_SECRET = process.env.JWT_SECRET;

exports.authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log("Received token:", token);
  console.log("JWT_SECRET:", JWT_SECRET);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await getUserById(decoded.id);

    if (!user) {
      console.log("User not found for id:", decoded.id);
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user; // прикрепляем пользователя к запросу
    next();
  } catch (error) {
    console.log("JWT verify error:", error.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
