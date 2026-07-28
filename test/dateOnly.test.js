const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const {
  isValidDateOnly,
  normalizeDateOnly,
} = require("../utils/dateOnly");

const validDates = [
  "2007-01-13",
  "1990-12-31",
  "2000-02-29",
  "2001-02-28",
  "2024-02-29",
  "2026-01-01",
  "2026-12-31",
];

const invalidDates = [
  "2001-02-29",
  "2026-02-30",
  "2026-04-31",
  "2026-13-01",
  "2026-00-01",
  "2026-01-00",
  "2026-1-1",
  "13.01.2007",
  "2007-01-13T00:00:00.000Z",
];

test("normalizes valid date-only strings without changing them", () => {
  for (const value of validDates) {
    assert.equal(isValidDateOnly(value), true, value);
    assert.equal(normalizeDateOnly(value), value);
  }

  assert.equal(normalizeDateOnly(null), null);
  assert.equal(normalizeDateOnly(undefined), null);
  assert.equal(normalizeDateOnly(""), null);
});

test("rejects malformed and impossible date-only values", () => {
  for (const value of invalidDates) {
    assert.equal(isValidDateOnly(value), false, value);
    assert.throws(
      () => normalizeDateOnly(value),
      (error) => error.statusCode === 400,
      value,
    );
  }

  for (const value of [123, true, {}, new Date()]) {
    assert.equal(isValidDateOnly(value), false);
    assert.throws(
      () => normalizeDateOnly(value),
      (error) => error.statusCode === 400,
    );
  }
});

test("normalization is identical in every target timezone", () => {
  const utilityPath = path.resolve(__dirname, "../utils/dateOnly.js");
  const timezones = [
    "UTC",
    "Asia/Almaty",
    "Europe/Istanbul",
    "America/New_York",
    "Pacific/Honolulu",
    "Pacific/Kiritimati",
  ];
  const script = `
    const { normalizeDateOnly } = require(${JSON.stringify(utilityPath)});
    process.stdout.write(normalizeDateOnly("2007-01-13"));
  `;

  for (const timezone of timezones) {
    const result = spawnSync(process.execPath, ["--eval", script], {
      encoding: "utf8",
      env: { ...process.env, TZ: timezone },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "2007-01-13", timezone);
  }
});
