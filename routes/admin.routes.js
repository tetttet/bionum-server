const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth.middleware');
const { createAdminGuard, rateLimit } = require('../middleware/admin.middleware');
const { parseQuery, missing } = require('../models/admin.model');
const router = express.Router();
router.use(authMiddleware, createAdminGuard(pool), rateLimit(pool, 'read', 120));
const wrap = fn => async (req, res) => { try {
    await fn(req, res);
}
catch {
    res.status(503).json({ error: 'Statistics temporarily unavailable' });
} };
router.use((req, res, next) => { try {
    req.filters = parseQuery(req.query);
    next();
}
catch {
    res.status(400).json({ error: 'Invalid query parameters' });
} });
router.get('/me', (req, res) => res.json({ id: req.user.id, admin: true }));
let dashboardCache = new Map();
let pending = new Map();
const subscriptionColumns = `s.id,s.user_id,s.provider,s.product_id,s.entitlement_id,s.status,s.will_renew,s.expires_at,s.latest_purchase_at,s.created_at`;
const userColumns = `u.id,u.first_name,u.last_name,u.email,u.created_at`;
const unavailableKpis = () => [
    ['dau', 'DAU'], ['wau', 'WAU'], ['mau', 'MAU'], ['active', 'Активные подписки'], ['free', 'Бесплатные пользователи'], ['paid', 'Платные пользователи'],
    ['newSubscriptions', 'Новые подписки'], ['cancellations', 'Отменённые подписки'], ['revenue', 'Подтверждённый доход'], ['todayRevenue', 'Доход сегодня'], ['monthRevenue', 'Доход за месяц'],
    ['mrr', 'MRR'], ['arr', 'ARR'], ['conversion', 'Free → Premium'], ['retention', 'Retention'], ['churn', 'Churn']
].map(([key, label]) => ({ key, ...missing(label) }));
async function dashboard(days) {
    const cached = dashboardCache.get(days);
    if (cached && cached.until > Date.now())
        return cached.data;
    if (pending.has(days))
        return pending.get(days);
    const task = (async () => {
        const { rows: [counts] } = await pool.query(`SELECT count(*)::int AS total,
      count(*) FILTER(WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC'))::int AS today,
      count(*) FILTER(WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC')-interval '1 day' AND created_at < (now() AT TIME ZONE 'UTC')-interval '1 day')::int AS previous_today,
      count(*) FILTER(WHERE created_at >= (now() AT TIME ZONE 'UTC')-interval '7 days')::int AS week,
      count(*) FILTER(WHERE created_at >= (now() AT TIME ZONE 'UTC')-interval '14 days' AND created_at < (now() AT TIME ZONE 'UTC')-interval '7 days')::int AS previous_week,
      count(*) FILTER(WHERE created_at >= (now() AT TIME ZONE 'UTC')-interval '30 days')::int AS month,
      count(*) FILTER(WHERE created_at >= (now() AT TIME ZONE 'UTC')-interval '60 days' AND created_at < (now() AT TIME ZONE 'UTC')-interval '30 days')::int AS previous_month FROM users`);
        const { rows: series } = await pool.query(`WITH dates AS (
      SELECT generate_series(date_trunc('day',now() AT TIME ZONE 'UTC')-($1::int-1)*interval '1 day',date_trunc('day',now() AT TIME ZONE 'UTC'),interval '1 day') AS day
    ), daily AS (SELECT date_trunc('day',created_at) AS day,count(*)::int AS value FROM users
      WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC')-($1::int-1)*interval '1 day' GROUP BY 1),
    baseline AS (SELECT count(*) AS n FROM users WHERE created_at < date_trunc('day',now() AT TIME ZONE 'UTC')-($1::int-1)*interval '1 day')
    SELECT to_char(d.day,'YYYY-MM-DD') AS day,coalesce(value,0)::int AS value,
      ((SELECT n FROM baseline)+sum(coalesce(value,0)) OVER(ORDER BY d.day))::int AS total
    FROM dates d LEFT JOIN daily USING(day) ORDER BY d.day`, [days]);
        const kpis = [{ key: 'total', label: 'Всего пользователей', value: counts.total }, ...[
                ['today', 'Новые сегодня'], ['week', 'Новые за 7 дней'], ['month', 'Новые за 30 дней']
            ].map(([key, label]) => ({ key, label, value: counts[key], previous: counts[`previous_${key}`], change: counts[`previous_${key}`] ? Math.round((counts[key] / counts[`previous_${key}`] - 1) * 1000) / 10 : null })), ...unavailableKpis()];
        const data = { kpis, series, timezone: 'UTC', updatedAt: new Date().toISOString() };
        dashboardCache.set(days, { until: Date.now() + 60000, data });
        return data;
    })();
    pending.set(days, task);
    try {
        return await task;
    }
    finally {
        pending.delete(days);
    }
}
router.get('/dashboard', wrap(async (req, res) => res.json(await dashboard(req.filters.days))));
async function hasSubscriptions() { const { rows } = await pool.query("SELECT to_regclass('public.subscriptions') IS NOT NULL AS present"); return rows[0].present; }
router.get('/users', wrap(async (req, res) => {
    const f = req.filters;
    const has = await hasSubscriptions();
    if (!has && (f.plan !== 'all' || f.status !== 'all' || f.sort === 'subscription'))
        return res.json({ items: [], page: f.page, hasMore: false, notice: 'Источник подписок не подключён' });
    const values = [`%${f.search.replace(/[\\%_]/g, '\\$&')}%`, f.limit + 1, (f.page - 1) * f.limit];
    const join = has ? `LEFT JOIN LATERAL (SELECT status,product_id,expires_at FROM subscriptions WHERE user_id=u.id ORDER BY created_at DESC,id DESC LIMIT 1) s ON true` : '';
    const filters = [`(concat_ws(' ',u.first_name,u.last_name,u.email,u.id::text) ILIKE $1)`];
    if (f.plan === 'premium')
        filters.push("s.status='active' AND (s.expires_at IS NULL OR s.expires_at>now())");
    if (f.plan === 'free')
        filters.push("s.status IS NULL");
    if (f.status === 'none')
        filters.push('s.status IS NULL');
    else if (f.status !== 'all') {
        values.push(f.status);
        filters.push(`s.status=$${values.length}`);
    }
    const sort = { newest: 'u.created_at DESC,u.id DESC', oldest: 'u.created_at ASC,u.id ASC', subscription: 's.expires_at DESC NULLS LAST,u.id DESC' }[f.sort];
    const { rows } = await pool.query(`SELECT ${userColumns}${has ? ',s.status AS recorded_status,s.product_id,s.expires_at' : ''} FROM users u ${join} WHERE ${filters.join(' AND ')} ORDER BY ${sort} LIMIT $2 OFFSET $3`, values);
    res.json({ items: rows.slice(0, f.limit), page: f.page, hasMore: rows.length > f.limit, notice: 'Тарифы — записи базы, не подтверждение Premium. Последняя активность и статус аккаунта не отслеживаются.' });
}));
async function providerStatus(userId) {
    if (!process.env.REVENUECAT_SECRET_API_KEY)
        return { state: 'not_connected' };
    try {
        const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}` }, signal: AbortSignal.timeout(8000) });
        if (!response.ok)
            return { state: 'unavailable' };
        const body = await response.json();
        const ent = body.subscriber?.entitlements?.[process.env.REVENUECAT_ENTITLEMENT_ID || 'pro'];
        if (!body.subscriber)
            return { state: 'unavailable' };
        const expiry = ent?.grace_period_expires_date || ent?.expires_date;
        const sandbox = body.subscriber.subscriptions?.[ent?.product_identifier]?.is_sandbox === true;
        return { state: 'verified', active: !sandbox && !!ent && (!expiry || Date.parse(expiry) > Date.now()), product: ent?.product_identifier ?? null, expiresAt: expiry ?? null, checkedAt: new Date().toISOString() };
    }
    catch {
        return { state: 'unavailable' };
    }
}
const validId = (req, res, next) => /^\d{1,10}$/.test(req.params.id) && Number(req.params.id) <= 2147483647 ? next() : res.status(400).json({ error: 'Invalid ID' });
router.get('/users/:id', validId, wrap(async (req, res) => {
    const { rows } = await pool.query(`SELECT ${userColumns} FROM users u WHERE u.id=$1`, [req.params.id]);
    if (!rows.length)
        return res.status(404).json({ error: 'User not found' });
    const subscriptions = await hasSubscriptions() ? (await pool.query(`SELECT ${subscriptionColumns} FROM subscriptions s WHERE s.user_id=$1 ORDER BY s.created_at DESC,s.id DESC LIMIT 50`, [req.params.id])).rows : [];
    res.json({ user: rows[0], subscriptions, provider: await providerStatus(req.params.id), notice: 'Последние 50 записей подписок. История платежей и активность не подключены.' });
}));
router.get('/subscriptions', wrap(async (req, res) => {
    const f = req.filters;
    if (!await hasSubscriptions())
        return res.json({ items: [], page: f.page, hasMore: false, notice: 'Источник подписок не подключён' });
    if (f.status === 'none')
        return res.json({ items: [], page: f.page, hasMore: false, notice: 'Пользователи без записей подписки доступны в разделе Users → Free.' });
    const values = [`%${f.search.replace(/[\\%_]/g, '\\$&')}%`, f.limit + 1, (f.page - 1) * f.limit];
    let where = `concat_ws(' ',u.email,u.first_name,u.last_name,s.product_id,s.id::text) ILIKE $1`;
    if (f.status !== 'all') {
        values.push(f.status);
        where += ` AND s.status=$4`;
    }
    const { rows } = await pool.query(`SELECT ${subscriptionColumns},u.email,u.first_name,u.last_name FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE ${where} ORDER BY s.created_at DESC,s.id DESC LIMIT $2 OFFSET $3`, values);
    res.json({ items: rows.slice(0, f.limit), page: f.page, hasMore: rows.length > f.limit, notice: 'Исторические записи не проверены провайдером. Откройте запись для актуальной проверки. Операции доступны только для чтения.' });
}));
router.get('/subscriptions/:id', validId, wrap(async (req, res) => {
    if (!await hasSubscriptions())
        return res.status(404).json({ error: 'Subscription not found' });
    const { rows } = await pool.query(`SELECT ${subscriptionColumns},u.email FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [req.params.id]);
    if (!rows.length)
        return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: rows[0], provider: await providerStatus(rows[0].user_id), notice: 'Стоимость, период оплаты, платежи и история событий не подтверждены источником.' });
}));
router.get('/revenue', wrap(async (req, res) => res.json({ updatedAt: new Date().toISOString(), kpis: ['Общая выручка', 'Выручка сегодня', 'Выручка за месяц', 'Предыдущий месяц', 'Успешные платежи', 'ARPU', 'ARPPU', 'MRR', 'ARR', 'Комиссии', 'Чистая выручка', 'AdMob Estimated Earnings', 'Impressions', 'eCPM', 'Requests', 'Match Rate'].map(label => missing(label)), notice: 'Нет доверенного реестра транзакций. Валюты не объединяются. AdMob Reporting API не подключён.' })));
router.get('/analytics', wrap(async (req, res) => res.json({ kpis: ['Сессии', 'Средняя длительность сессии', 'DAU', 'WAU', 'MAU', 'Retention', 'Cohort Retention', 'Churn', 'Использование функций', 'Версии приложения', 'Платформы', 'Использование шагомера'].map(label => missing(label)), notice: 'События активности хранятся на устройстве и не поступают на сервер. Регистрация не считается активностью.' })));
router.get('/system/health', wrap(async (req, res) => {
    const start = Date.now();
    await pool.query('SELECT 1');
    res.json({ updatedAt: new Date().toISOString(), kpis: [{ label: 'Backend', value: 'Доступен' }, { label: 'База данных', value: 'Подключена' }, { label: 'Проверка БД', value: `${Date.now() - start} мс` }, { label: 'Admin API', value: 'v1' }, { label: 'RevenueCat', value: process.env.REVENUECAT_SECRET_API_KEY ? 'Настроен (не проверен)' : 'Не подключён' }, missing('Агрегированные ошибки сервера')] });
}));
module.exports = router;
