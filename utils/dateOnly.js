function normalizeDateOnly(value) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string") {
    const error = new Error(
      "date_of_birth must be a string in YYYY-MM-DD format",
    );
    error.statusCode = 400;
    throw error;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const error = new Error("date_of_birth must be in YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1) {
    throwBadDate();
  }

  if (month < 1 || month > 12) {
    throwBadDate();
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  if (day < 1 || day > daysInMonth) {
    throwBadDate();
  }

  return value;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function throwBadDate() {
  const error = new Error("date_of_birth is not a valid calendar date");
  error.statusCode = 400;
  throw error;
}

module.exports = { normalizeDateOnly };
