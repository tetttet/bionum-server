const test = require('node:test');
const assert = require('node:assert/strict');
// Opt-in isolated PostgreSQL only. Never reads DATABASE_URL from dotenv.
test('admin HTTP contracts against isolated PostgreSQL', { skip: process.env.RUN_ADMIN_INTEGRATION !== '1' }, async (t) => {
    assert.match(process.env.DATABASE_URL || '', /^postgres(?:ql)?:\/\/[^/]*@127\.0\.0\.1:55439\/bionum_admin_test$/);
    process.env.JWT_SECRET = 'isolated-admin-test-secret';
    delete process.env.REVENUECAT_SECRET_API_KEY;
    const pool = require('../config/db');
    delete process.env.REVENUECAT_SECRET_API_KEY;
    const jwt = require('jsonwebtoken');
    const express = require('express');
    await pool.query(`DROP TABLE IF EXISTS admin_rate_limits,admin_identity,subscriptions,users CASCADE;
    CREATE TABLE users(id SERIAL PRIMARY KEY,first_name TEXT,last_name TEXT,middle_name TEXT,email TEXT,password TEXT,role TEXT,date_of_birth DATE,created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'UTC'),updated_at TIMESTAMP DEFAULT now());
    CREATE TABLE subscriptions(id SERIAL PRIMARY KEY,user_id INTEGER,provider TEXT,product_id TEXT,entitlement_id TEXT,status TEXT,will_renew BOOLEAN,expires_at TIMESTAMPTZ,latest_purchase_at TIMESTAMPTZ,created_at TIMESTAMP DEFAULT now());`);
    await require('../models/admin.model').initAdminTables(pool);
    await pool.query(`INSERT INTO users(id,first_name,last_name,email,password) VALUES(11,'Admin','One','Knyazova@mail.ru','secret-hash'),(12,'Admin','Two','bot@gmail.com','secret-hash'),(13,'Ordinary','User','other@example.test','secret-hash');`);
    const app = express();
    app.use(express.json());
    app.use('/api/admin-access', require('../routes/admin-access.routes'));
    app.use('/api/admin', require('../routes/admin.routes'));
    app.use('/api/users', require('../routes/user.routes'));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const url = `http://127.0.0.1:${server.address().port}/api/`;
    async function request(path, id = 11, options = {}) {
        const response = await fetch(url + path, { ...options, headers: { ...(id ? { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '5m' })}` } : {}), 'Content-Type': 'application/json', ...options.headers } });
        return { status: response.status, body: await response.json(), headers: response.headers };
    }
    try {
        await t.test('unauthenticated and ordinary requests denied on every endpoint', async () => {
            for (const path of ['me', 'dashboard', 'users', 'users/11', 'subscriptions', 'subscriptions/1', 'revenue', 'analytics', 'system/health']) {
                assert.equal((await request('admin/' + path, null)).status, 401);
                assert.equal((await request('admin/' + path, 13)).status, 403);
            }
        });
        await t.test('both admins enter immediately without email codes or ID settings', async () => {
            for (const id of [11,12]) {
                const status=await request('admin-access/status',id);
                assert.equal(status.status,200);
                assert.equal(status.body.eligible,true);
                assert.equal(typeof status.body.expiresAt,'number');
                assert.equal((await request('admin/me',id)).status,200);
            }
            assert.equal((await request('admin-access/status',13)).status,403);
        });
        await t.test('real SQL growth aggregation and zero denominators', async () => {
            const r = await request('admin/dashboard?days=7');
            assert.equal(r.status, 200);
            assert.equal(r.headers.get('cache-control'), 'no-store');
            assert.equal(r.body.kpis[0].value, 3);
            assert.equal(r.body.kpis[1].value, 3);
            assert.equal(r.body.kpis[1].change, null);
            assert.equal(r.body.series.length, 7);
            assert.equal(r.body.series.at(-1).total, 3);
            assert.equal(r.body.series.reduce((sum, p) => sum + p.value, 0), 3);
            assert.equal(r.body.kpis.find(k => k.key === 'revenue').value, null);
        });
        await t.test('pagination, filters, safe search, details and no sensitive fields', async () => {
            let r = await request('admin/users?limit=2');
            assert.equal(r.body.items.length, 2);
            assert.equal(r.body.hasMore, true);
            r = await request('admin/users?limit=2&page=2');
            assert.equal(r.body.items.length, 1);
            assert.equal(r.body.hasMore, false);
            r = await request('admin/users?search=bot%40gmail.com');
            assert.equal(r.body.items[0].id, 12);
            r = await request('admin/users?search=%27%3BSELECT');
            assert.equal(r.body.items.length, 0);
            r = await request('admin/users?limit=0');
            assert.equal(r.status, 400);
            r = await request('admin/users/11');
            assert.equal(r.body.user.id, 11);
            assert.equal(r.body.provider.state, 'not_connected');
            for (const field of ['password', 'date_of_birth', 'role', 'raw_customer_info_json'])
                assert(!JSON.stringify(r.body).includes(field));
            assert.equal((await request('admin/users/99999')).status, 404);
            assert.equal((await request('admin/subscriptions')).body.items.length, 0);
        });
        await t.test('subscription reads retain unverified provenance and provider failures never grant access', async () => {
            await pool.query("INSERT INTO subscriptions(user_id,provider,product_id,entitlement_id,status,will_renew) VALUES(13,'app_store','monthly','pro','active',true)");
            const r = await request('admin/subscriptions?status=active');
            assert.equal(r.body.items.length, 1);
            assert.match(r.body.notice, /не проверены/);
            assert.equal((await request('admin/subscriptions/1')).body.provider.state, 'not_connected');
            assert.equal((await request('admin/users?plan=premium')).body.items[0].id, 13);
            assert.equal((await request('admin/users?plan=free')).body.items.length, 2);
        });
        await t.test('provider verification respects expiry, cancellation and sandbox without leaking payloads', async () => {
            process.env.REVENUECAT_SECRET_API_KEY = 'test-only';
            const originalFetch = global.fetch;
            try {
                for (const scenario of [
                    { expiry: '2099-01-01', sandbox: false, active: true },
                    { expiry: '2000-01-01', sandbox: false, active: false },
                    { expiry: '2099-01-01', sandbox: true, active: false }
                ]) {
                    global.fetch = async (url, options) => String(url).startsWith('https://api.revenuecat.com/')
                        ? Response.json({ subscriber: { entitlements: { pro: { product_identifier: 'monthly', expires_date: scenario.expiry } }, subscriptions: { monthly: { is_sandbox: scenario.sandbox, unsubscribe_detected_at: '2026-01-01' } }, secret_field: 'never-return' } })
                        : originalFetch(url, options);
                    const result = await request('admin/subscriptions/1');
                    assert.equal(result.body.provider.state, 'verified');
                    assert.equal(result.body.provider.active, scenario.active);
                    assert(!JSON.stringify(result.body).includes('never-return'));
                }
                global.fetch = async (url, options) => String(url).startsWith('https://api.revenuecat.com/') ? new Response('', { status: 503 }) : originalFetch(url, options);
                assert.equal((await request('admin/subscriptions/1')).body.provider.state, 'unavailable');
            }
            finally {
                global.fetch = originalFetch;
                delete process.env.REVENUECAT_SECRET_API_KEY;
            }
        });
        await t.test('remaining contracts report unavailable metrics and healthy database', async () => {
            for (const section of ['revenue', 'analytics']) {
                const r = await request('admin/' + section);
                assert.equal(r.status, 200);
                assert(r.body.kpis.every(m => m.value === null));
            }
            assert.equal((await request('admin/system/health')).body.kpis[1].value, 'Подключена');
        });
        await t.test('legacy unauthenticated user takeover and role injection are blocked', async () => {
            assert.equal((await request('users/11', null, { method: 'PUT', body: JSON.stringify({ password: 'changed' }) })).status, 401);
            assert.equal((await request('users/11', 13, { method: 'PUT', body: JSON.stringify({ email: 'other@example.test' }) })).status, 403);
            assert.equal((await request('users/13', 13, { method: 'PUT', body: JSON.stringify({ first_name: 'Safe', role: 'admin', isAdmin: true }) })).status, 200);
            for (const email of ['KNYAZOVA@mail.ru','BOT@GMAIL.COM']) {
                assert.equal((await request('users/13',13,{method:'PUT',body:JSON.stringify({email})})).status,403);
            }
            const {getUserByEmail}=require('../models/user.model');
            assert.equal((await getUserByEmail('KNYAZOVA@MAIL.RU')).id,11);
            const { rows } = await pool.query('SELECT role FROM users WHERE id=13');
            assert.equal(rows[0].role, null);
        });
        await t.test('expired session and changed email lose access', async () => {
            assert.equal((await request('admin/me', 11, { headers: { Authorization: `Bearer ${jwt.sign({ id: 11 }, process.env.JWT_SECRET, { expiresIn: -1 })}` } })).status, 401);
            await pool.query("UPDATE users SET email='different@example.test' WHERE id=11");
            assert.equal((await request('admin/me', 11)).status, 403);
            await pool.query("UPDATE users SET email='another@example.test' WHERE id=12");
            assert.equal((await request('admin/me', 12)).status, 403);
        });
    }
    finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
    }
});
