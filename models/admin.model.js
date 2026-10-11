async function initAdminTables(pool) {
    await pool.query(`CREATE TABLE IF NOT EXISTS admin_rate_limits (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL, bucket TIMESTAMPTZ NOT NULL, hits INTEGER NOT NULL,
    PRIMARY KEY(user_id,scope)
  );`);
}
const missing = (label, reason = 'Источник данных не подключён') => ({ label, value: null, reason });
function parseQuery(query) {
    const integer = (key, fallback, min, max) => {
        const v = query[key] ?? String(fallback);
        if (typeof v !== 'string' || !/^\d+$/.test(v) || Number(v) < min || Number(v) > max)
            throw new Error('Invalid query');
        return Number(v);
    };
    const choice = (key, fallback, options) => {
        const v = query[key] ?? fallback;
        if (!options.includes(v))
            throw new Error('Invalid query');
        return v;
    };
    const search = query.search ?? '';
    if (typeof search !== 'string' || search.length > 100)
        throw new Error('Invalid search');
    return { page: integer('page', 1, 1, 100000), limit: integer('limit', 25, 1, 100),
        days: choice('days', '30', ['7', '30', '90', '365']), search,
        plan: choice('plan', 'all', ['all', 'free', 'premium']),
        status: choice('status', 'all', ['all', 'active', 'expired', 'canceled', 'trial', 'none']),
        sort: choice('sort', 'newest', ['newest', 'oldest', 'subscription']) };
}
module.exports = { initAdminTables, missing, parseQuery };
