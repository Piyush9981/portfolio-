const fs = require('fs');
const path = require('path');
const db = require('./database');

async function runMigration() {
  console.log('[Migration] Starting database schema execution...');
  try {
    const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(sql);
    console.log('[Migration] Schema execution completed successfully.');
  } catch (err) {
    console.error('[Migration Error]: Failed to run schema migration', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
