const pool = require("../config/db");

const WebhookEventsModel = {
  async create({
    event_id,
    event_type,
    app_user_id = null,
    payload_json,
    processed_at = null,
  }) {
    const query = `
      INSERT INTO webhook_events (
        event_id,
        event_type,
        app_user_id,
        payload_json,
        processed_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const values = [
      event_id,
      event_type,
      app_user_id,
      payload_json,
      processed_at,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async findById(id) {
    const query = `
      SELECT * FROM webhook_events
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  async findByEventId(eventId) {
    const query = `
      SELECT * FROM webhook_events
      WHERE event_id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [eventId]);
    return result.rows[0];
  },

  async findAll(limit = 50) {
    const query = `
      SELECT * FROM webhook_events
      ORDER BY received_at DESC
      LIMIT $1;
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  },

  async markProcessed(eventId) {
    const query = `
      UPDATE webhook_events
      SET processed_at = CURRENT_TIMESTAMP
      WHERE event_id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [eventId]);
    return result.rows[0];
  },

  async deleteById(id) {
    const query = `
      DELETE FROM webhook_events
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },
};

module.exports = WebhookEventsModel;
