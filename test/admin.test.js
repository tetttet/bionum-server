const test = require('node:test');
const assert = require('node:assert/strict');
const { eligible, createAdminGuard, rateLimit } = require('../middleware/admin.middleware');
const { parseQuery } = require('../models/admin.model');
function response() { return { code: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; }
test('only the two case-insensitive emails qualify without ID configuration', () => {
    for (const email of ['Knyazova@mail.ru', 'BOT@gmail.com', ' knyazova@mail.ru ']) {
        assert(eligible({ id: 11, email }));
    }
    for (const user of [{email:'other@mail.ru',role:'admin',isAdmin:true}, {email:'bot@gmail.com.evil'}, null]) assert(!eligible(user));
});
test('guard allows both server identities and ignores client-supplied email and role', async () => {
    for (const email of ['Knyazova@mail.ru', 'bot@gmail.com']) {
        const res=response(); let allowed=false;
        await createAdminGuard()({user:{id:11,email}},res,()=>allowed=true);
        assert(allowed);assert.equal(res.headers['Cache-Control'],'no-store');
    }
    const res=response();
    await createAdminGuard()({user:{id:99,email:'other@mail.ru'},body:{email:'bot@gmail.com',role:'admin'},query:{email:'Knyazova@mail.ru'}},res,()=>assert.fail('must deny'));
    assert.equal(res.code,403);
});
test('rate limiting returns 429 and Retry-After', async () => { const res = response(); await rateLimit({ query: async () => ({ rows: [{ hits: 121 }] }) }, 'read', 120)({ user: { id: 11 } }, res, () => assert.fail()); assert.equal(res.code, 429); assert.equal(res.headers['Retry-After'], '60'); });
test('query validation bounds pages, ranges, filters and types', () => {
    assert.equal(parseQuery({}).limit, 25);
    assert.equal(parseQuery({ days: '365', limit: '100' }).days, '365');
    for (const query of [{ page: '0' }, { page: '-1' }, { limit: '101' }, { days: '1000' }, { sort: 'password' }, { search: ['a'] }, { search: 'x'.repeat(101) }, { status: 'active; DROP TABLE users' }, { plan: 'admin' }])
        assert.throws(() => parseQuery(query));
});
