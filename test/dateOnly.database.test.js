const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeDateOnly } = require("../utils/dateOnly");

const runDatabaseTest = process.env.RUN_DB_DATE_ONLY_TEST === "1";

test(
  "frontend payload -> PostgreSQL DATE -> API response preserves the day",
  { skip: !runDatabaseTest },
  async () => {
    require("dotenv").config({ quiet: true });
    const { Client } = require("pg");
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    await client.connect();

    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TEMP TABLE date_only_lifecycle_test (
          id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          date_of_birth DATE
        ) ON COMMIT DROP
      `);

      const frontendPayload = { date_of_birth: "2007-01-13" };
      const backendValue = normalizeDateOnly(frontendPayload.date_of_birth);
      const inserted = await client.query(
        `INSERT INTO date_only_lifecycle_test (date_of_birth)
         VALUES ($1::date)
         RETURNING TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth`,
        [backendValue],
      );
      const apiResponse = inserted.rows[0];

      assert.deepEqual(apiResponse, { date_of_birth: "2007-01-13" });

      const repeatPayload = {
        date_of_birth: normalizeDateOnly(apiResponse.date_of_birth),
      };
      const updated = await client.query(
        `UPDATE date_only_lifecycle_test
         SET date_of_birth = $1::date
         WHERE id = $2
         RETURNING TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth`,
        [repeatPayload.date_of_birth, 1],
      );

      assert.deepEqual(updated.rows[0], apiResponse);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
