// Preloaded before every test file — ensures correct test env vars are set.
// Prevents misleading failures when bun test is run without bun run test:setup.
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
if (!process.env.PORT) process.env.PORT = '3100';
if (!process.env.TEST_BASE_URL) process.env.TEST_BASE_URL = `http://localhost:${process.env.PORT}`;
if (!process.env.DISABLE_RATE_LIMIT) process.env.DISABLE_RATE_LIMIT = 'true';
