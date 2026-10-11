-- Optional online indexes. Run individually outside a transaction after review.
-- No automatic production execution. subscriptions must already exist.
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_admin_created_id ON users (created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS subscriptions_admin_user_created_id ON subscriptions (user_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS subscriptions_admin_created_id ON subscriptions (created_at DESC, id DESC);
-- Search uses bound ILIKE parameters. For high-volume substring searches, review
-- pg_trgm availability and EXPLAIN plans before adding a matching expression index.
