const pool = require("../config/db");

const SubscriptionsModel = {
  async create({
    user_id,
    provider,
    product_id,
    entitlement_id = "pro",
    status,
    will_renew = false,
    expires_at = null,
    latest_purchase_at = null,
    original_transaction_id = null,
    raw_customer_info_json = null,
  }) {
    const query = `
      INSERT INTO subscriptions (
        user_id,
        provider,
        product_id,
        entitlement_id,
        status,
        will_renew,
        expires_at,
        latest_purchase_at,
        original_transaction_id,
        raw_customer_info_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const values = [
      user_id,
      provider,
      product_id,
      entitlement_id,
      status,
      will_renew,
      expires_at,
      latest_purchase_at,
      original_transaction_id,
      raw_customer_info_json,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async findById(id) {
    const query = `
      SELECT * FROM subscriptions
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  async findByUserId(userId) {
    const query = `
      SELECT * FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  },

  async findActiveByUserId(userId) {
    const query = `
      SELECT * FROM subscriptions
      WHERE user_id = $1
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  },

  async findByOriginalTransactionId(originalTransactionId) {
    const query = `
      SELECT * FROM subscriptions
      WHERE original_transaction_id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [originalTransactionId]);
    return result.rows[0];
  },

  async updateById(id, data) {
    const fields = [];
    const values = [];
    let index = 1;

    for (const key in data) {
      fields.push(`${key} = $${index}`);
      values.push(data[key]);
      index++;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE subscriptions
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *;
    `;

    values.push(id);

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async updateByOriginalTransactionId(originalTransactionId, data) {
    const fields = [];
    const values = [];
    let index = 1;

    for (const key in data) {
      fields.push(`${key} = $${index}`);
      values.push(data[key]);
      index++;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE subscriptions
      SET ${fields.join(", ")}
      WHERE original_transaction_id = $${index}
      RETURNING *;
    `;

    values.push(originalTransactionId);

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async deleteById(id) {
    const query = `
      DELETE FROM subscriptions
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },
};

module.exports = SubscriptionsModel;
