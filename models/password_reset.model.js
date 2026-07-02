const pool = require("../config/db");

async function initPasswordResetTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_email
    ON password_reset_codes(email);
  `);

  console.log("✅ Table 'password_reset_codes' ensured.");
}

async function invalidatePreviousCodes(email) {
  await pool.query(
    `
    UPDATE password_reset_codes
    SET used = TRUE
    WHERE email = $1 AND used = FALSE
    `,
    [email]
  );
}

async function createResetCode({ email, code, expires_at }) {
  const result = await pool.query(
    `
    INSERT INTO password_reset_codes (email, code, expires_at)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [email, code, expires_at]
  );

  return result.rows[0];
}

async function getActiveResetCode(email, code) {
  const result = await pool.query(
    `
    SELECT *
    FROM password_reset_codes
    WHERE email = $1
      AND code = $2
      AND used = FALSE
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [email, code]
  );

  return result.rows[0];
}

async function markResetCodeUsed(id) {
  const result = await pool.query(
    `
    UPDATE password_reset_codes
    SET used = TRUE
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}

async function incrementResetAttempts(id) {
  const result = await pool.query(
    `
    UPDATE password_reset_codes
    SET attempts = attempts + 1
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}

async function deleteResetCodesByEmail(email) {
  await pool.query(
    `
    DELETE FROM password_reset_codes
    WHERE email = $1
    `,
    [email]
  );
}

module.exports = {
  initPasswordResetTable,
  invalidatePreviousCodes,
  createResetCode,
  getActiveResetCode,
  markResetCodeUsed,
  incrementResetAttempts,
  deleteResetCodesByEmail,
};
