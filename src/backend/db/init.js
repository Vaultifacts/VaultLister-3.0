// Database initialisation script — called by `bun run db:init`
// Applies pg-schema.sql and seeds via initializeDatabase().
// For PostgreSQL: the database must already exist (created by Railway or docker-compose).

const { initializeDatabase } = await import('./database.js');
await initializeDatabase();
console.log('✓ Database initialized');
