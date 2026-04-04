-- Migration 114: Apply VARCHAR length constraints to PII text columns in users
-- email: VARCHAR(254) per RFC 5321 maximum address length
-- username: VARCHAR(255) per common convention

ALTER TABLE users ALTER COLUMN email    TYPE VARCHAR(254);
ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(255);

-- DOWN:
-- ALTER TABLE users ALTER COLUMN email    TYPE TEXT;
-- ALTER TABLE users ALTER COLUMN username TYPE TEXT;
