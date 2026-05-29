import { pool } from '../src/db';
import { env } from '../src/env';
import bcrypt from 'bcryptjs';

async function main() {
  const hash = bcrypt.hashSync(env.ADMIN_PASSWORD, 12);

  const result = await pool.query(
    `INSERT INTO usuarios (email, nombre, password_hash, rol)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [env.ADMIN_EMAIL, env.ADMIN_NOMBRE, hash]
  );

  if (result.rowCount && result.rowCount > 0) {
    console.log(`Admin created: ${env.ADMIN_EMAIL}`);
  } else {
    console.log(`Admin already exists: ${env.ADMIN_EMAIL}`);
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await pool.end();
    process.exit(1);
  });
