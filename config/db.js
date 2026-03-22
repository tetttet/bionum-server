const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅✅✅ Подключение к базе прошло успешно:", result.rows[0].now);
  } catch (err) {
    console.error("❌❌❌ Ошибка подключения к базе:", err.message);
    process.exit(1);
  }
})();

module.exports = pool;
