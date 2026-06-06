require('dotenv').config();
const { Pool } = require('pg');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable de entorno requerida: ${name}`);
  return v;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for seeding when running remotely');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const products = [
  ['Salmón Premium', 24.99, 50, 'Alimento premium para gatos con salmón fresco'],
  ['Snacks Pollo', 12.99, 75, 'Deliciosos snacks con sabor a pollo'],
  ['Alimento Light', 19.99, 60, 'Alimento bajo en calorías para gatos adultos']
];

(async () => {
  try {
    const countRes = await pool.query('SELECT COUNT(*) AS count FROM alimentos');
    if (Number(countRes.rows[0].count) === 0) {
      for (const product of products) {
        await pool.query(
          'INSERT INTO alimentos (nombre, precio, stock, descripcion) VALUES ($1, $2, $3, $4)',
          product
        );
      }
      console.log('INSERTED');
    } else {
      console.log('SKIPPED, already has rows');
    }
  } catch (err) {
    console.error('ERROR', err.message);
  } finally {
    await pool.end();
  }
})();