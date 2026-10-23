import pg from 'pg';

// Usage: node scripts/check-clear.mjs
// Reads DATABASE_URL from env and prints counts for key tables.

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    const tables = ['attendance','tasks','cash_vouchers','proposals','notes','messages','checkins'];
    for (const t of tables) {
      const res = await pool.query(`SELECT count(*)::int as c FROM ${t}`);
      console.log(`${t}: ${res.rows[0].c}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(3);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
