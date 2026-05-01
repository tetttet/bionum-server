const pool = require("../config/db");
const { normalizeDateOnly } = require("../utils/dateOnly");

const USER_COLUMNS = `
  id,
  first_name,
  middle_name,
  last_name,
  TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
  email,
  role,
  password,
  created_at,
  updated_at
`;

// --- Создание таблицы users (если её нет)
async function initUserTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      middle_name VARCHAR(100),
      last_name VARCHAR(100) NOT NULL,
      date_of_birth DATE,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
  console.log("✅ Table 'users' ensured.");
}

// --- Создать пользователя
async function createUser({
  first_name,
  middle_name,
  last_name,
  date_of_birth,
  email,
  password,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDateOfBirth = normalizeDateOnly(date_of_birth);

  const result = await pool.query(
    `INSERT INTO users (first_name, middle_name, last_name, date_of_birth, email, password)
     VALUES ($1, $2, $3, $4::date, $5, $6)
     RETURNING ${USER_COLUMNS}`,
    [
      first_name,
      middle_name,
      last_name,
      normalizedDateOfBirth,
      normalizedEmail,
      password,
    ],
  );
  return result.rows[0];
}

// --- Получить всех пользователей
async function getAllUsers() {
  const result = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users ORDER BY id ASC`,
  );
  return result.rows;
}

// --- Получить пользователя по ID
async function getUserById(id) {
  const result = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0];
}

// --- Получить пользователя по email
async function getUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
    [normalizedEmail],
  );
  return result.rows[0];
}

// --- Обновить данные пользователя
async function updateUser(id, fields) {
  if (Object.prototype.hasOwnProperty.call(fields, "date_of_birth")) {
    fields.date_of_birth = normalizeDateOnly(fields.date_of_birth);
  }

  const filteredEntries = Object.entries(fields).filter(
    ([, value]) => value !== undefined,
  );

  if (filteredEntries.length === 0) return null;

  const keys = filteredEntries.map(([key]) => key);
  const values = filteredEntries.map(([, value]) => value);

  const setClause = keys
    .map((key, idx) =>
      key === "date_of_birth"
        ? `${key} = $${idx + 1}::date`
        : `${key} = $${idx + 1}`,
    )
    .join(", ");

  const result = await pool.query(
    `UPDATE users
     SET ${setClause}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${keys.length + 1}
     RETURNING ${USER_COLUMNS}`,
    [...values, id],
  );

  return result.rows[0];
}

// --- Обновить пароль по email
async function updateUserPasswordByEmail(email, hashedPassword) {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `
    UPDATE users
    SET password = $1, updated_at = CURRENT_TIMESTAMP
    WHERE email = $2
    RETURNING ${USER_COLUMNS}
    `,
    [hashedPassword, normalizedEmail],
  );

  return result.rows[0];
}

// --- Удалить пользователя
async function deleteUser(id) {
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  return { message: "User deleted" };
}

module.exports = {
  initUserTable,
  createUser,
  getAllUsers,
  getUserById,
  getUserByEmail,
  updateUser,
  updateUserPasswordByEmail,
  normalizeDateOnly,
  deleteUser,
};
