/**
 * Reset password for a user
 * 
 * Usage: node scripts/reset-password.mjs <email> <new-password>
 * Example: node scripts/reset-password.mjs cuongpk.giong04@gmail.com Admin123!
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
  return salt + ':' + hash.toString('hex');
}

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  
  if (!email || !newPassword) {
    console.log('Usage: node scripts/reset-password.mjs <email> <new-password>');
    console.log('Example: node scripts/reset-password.mjs cuongpk.giong04@gmail.com Admin123!');
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
      'SELECT id, email, name FROM "user" WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`User with email ${email} not found`);
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log(`Found user: ${user.name} (${user.email})`);
    
    // Check if account exists
    const accountResult = await pool.query(
      'SELECT id, "providerId" FROM account WHERE "userId" = $1',
      [user.id]
    );
    
    console.log('Accounts:', accountResult.rows);
    
    // Hash new password
    const newHash = hashPassword(newPassword);
    console.log('New hash:', newHash);
    
    // Update or create account
    if (accountResult.rows.length > 0) {
      // Update existing account
      await pool.query(
        'UPDATE account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2',
        [newHash, user.id]
      );
      console.log('Password updated successfully!');
    } else {
      // Create new account
      await pool.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
        [crypto.randomUUID(), user.id, newHash]
      );
      console.log('Account created with new password!');
    }
    
    console.log(`\nLogin with:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

resetPassword();
