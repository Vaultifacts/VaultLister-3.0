// Migration: Add security_logs table
import { query } from '../database.js';

export function up() {
    console.log('Running migration: add_security_logs');

    // Create security_logs table
    query.run(`
        CREATE TABLE IF NOT EXISTS security_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            ip_or_user TEXT NOT NULL,
            user_id TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Create indexes
    query.run('CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type)');
    query.run('CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at)');
    query.run('CREATE INDEX IF NOT EXISTS idx_security_logs_ip_or_user ON security_logs(ip_or_user)');

    console.log('✓ Security logs table created');
}

export function down() {
    query.run('DROP TABLE IF EXISTS security_logs');
    console.log('✓ Security logs table dropped');
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    up();
}
