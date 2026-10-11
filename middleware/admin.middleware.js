const EMAILS = ['knyazova@mail.ru', 'bot@gmail.com'];
function eligible(user) {
    return EMAILS.includes(String(user?.email || '').trim().toLowerCase());
}
function createAdminGuard() {
    return (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        // req.user is reloaded from the database by authMiddleware, never from request input.
        if (!eligible(req.user)) return res.status(403).json({ error: 'Admin access denied' });
        next();
    };
}
// Shared database buckets also work across multiple server instances.
function rateLimit(pool, scope, limit) {
    return async (req, res, next) => {
        try {
            const { rows } = await pool.query(`INSERT INTO admin_rate_limits (user_id,scope,bucket,hits)
        VALUES ($1,$2,date_trunc('minute',now()),1) ON CONFLICT (user_id,scope)
        DO UPDATE SET bucket=EXCLUDED.bucket, hits=CASE WHEN admin_rate_limits.bucket=EXCLUDED.bucket THEN admin_rate_limits.hits+1 ELSE 1 END RETURNING hits`, [req.user.id, scope]);
            if (rows[0].hits > limit)
                return res.status(429).set('Retry-After', '60').json({ error: 'Too many requests' });
            next();
        }
        catch {
            res.status(503).json({ error: 'Service unavailable' });
        }
    };
}
module.exports = { eligible, createAdminGuard, rateLimit };
