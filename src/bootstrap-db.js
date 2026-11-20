const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const pool = require('./config/db');

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'init.sql'),
    'utf8'
  );

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s =>
      s &&
      !/^(CREATE\s+DATABASE|USE\s+)/i.test(s)
    );

  try {
    for (const statement of statements) {
      await pool.query(statement);
    }

    console.log('Database schema initialized.');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
});
