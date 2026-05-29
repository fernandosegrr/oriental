import { pool } from '../src/db';
import fs from 'fs';
import path from 'path';

async function main() {
  // Ensure _migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL      PRIMARY KEY,
      name       TEXT        UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Gather all .sql files in the same directory as this runner
  const migrationsDir = __dirname;
  const allFiles = fs.readdirSync(migrationsDir);
  const sqlFiles = allFiles
    .filter((f) => f.endsWith('.sql'))
    .sort(); // ascending by filename

  let applied = 0;
  let skipped = 0;

  for (const file of sqlFiles) {
    // Check if already applied
    const check = await pool.query(
      'SELECT 1 FROM _migrations WHERE name = $1',
      [file]
    );

    if (check.rowCount && check.rowCount > 0) {
      console.log(`  [skip]  ${file}`);
      skipped++;
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`  [apply] ${file}`);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  [ERROR] ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`\nMigrations complete: ${applied} applied, ${skipped} skipped.`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Migration runner failed:', err);
    await pool.end();
    process.exit(1);
  });
