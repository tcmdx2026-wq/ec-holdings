/**
 * Check user in database
 * 
 * Usage: node scripts/check-user.mjs <email>
 * Example: node scripts/check-user.mjs cuongpk.giong04@gmail.com
 */

import pg from 'pg';

const { Pool } = pg;

async function checkUser() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('Usage: node scripts/check-user.mjs <email>');
    console.log('Example: node scripts/check-user.mjs cuongpk.giong04@gmail.com');
    process.exit(1);
  }
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }
  
  console.log('Connecting to database...');
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email, name, "emailVerified" FROM "user" WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`\n❌ User with email ${email} not found in database`);
      console.log('\nYou may need to register first or check the email address.');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log(`\n✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    
    // Check accounts
    const accountResult = await pool.query(
      'SELECT id, "providerId", "createdAt" FROM account WHERE "userId" = $1',
      [user.id]
    );
    
    if (accountResult.rows.length === 0) {
      console.log('\n⚠️  No login accounts found for this user');
      console.log('   The user exists but has no password set.');
    } else {
      console.log('\n📋 Login accounts:');
      accountResult.rows.forEach((acc, i) => {
        console.log(`   ${i + 1}. Provider: ${acc.providerId} (created: ${acc.createdAt})`);
      });
    }
    
    // Check registration requests
    const regResult = await pool.query(
      'SELECT id, status, "requestedAt" FROM registration_requests WHERE email = $1',
      [email]
    );
    
    if (regResult.rows.length > 0) {
      console.log('\n📝 Registration requests:');
      regResult.rows.forEach((reg, i) => {
        console.log(`   ${i + 1}. Status: ${reg.status} (requested: ${reg.requestedAt})`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkUser();
