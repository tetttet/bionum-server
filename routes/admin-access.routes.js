const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth.middleware');
const { createAdminGuard, rateLimit } = require('../middleware/admin.middleware');
const router = express.Router();
router.use(authMiddleware, createAdminGuard(), rateLimit(pool, 'access', 30));
router.get('/status', (req, res) => {
    res.json({ eligible: true, expiresAt: req.authExpiresAt });
});
module.exports = router;
