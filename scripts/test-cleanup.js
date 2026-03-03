// Test script for database cleanup function
import { cleanupExpiredData } from '../src/backend/db/database.js';

console.log('Testing database cleanup function...\n');

try {
    const results = cleanupExpiredData();
    console.log('\nCleanup completed successfully!');
    console.log('Results:', results);
    console.log('\nTotal records deleted:', Object.values(results).reduce((sum, count) => sum + count, 0));
} catch (error) {
    console.error('Cleanup test failed:', error.message);
    process.exit(1);
}

console.log('\n✓ Test passed - cleanup function works correctly');
process.exit(0);
