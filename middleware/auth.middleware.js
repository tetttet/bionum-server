const jwt = require("jsonwebtoken");
const db = require("../config/db"); // это pool из pg
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

    // ✅ Запрос к базе напрямую через pool.query
    const result = await db.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [
      decoded.id,
    ]);
    const user = result.rows[0];

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
