/**
 * Fix password - uses exact same scrypt params as Better Auth
 * Run: node scripts/fix-password.mjs
 */

import { randomBytes, scrypt, randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

// Exact same config as Better Auth: @better-auth/utils/dist/password.node.mjs
const config = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64
};

function generateKey(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      config.dkLen,
      {
        N: config.N,
        r: config.r,
        p: config.p,
        maxmem: 128 * config.N * config.r * 2
      },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(hash, password) {
  const [salt, key] = hash.split(":");
  const targetKey = await generateKey(password, salt);
  return targetKey.toString("hex") === key;
}

async function fixPassword() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }
  
  console.log('Connecting to database...');
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    const email = 'cuongpk.giong04@gmail.com';
    const newPassword = 'Admin123!';
    
    // Get user ID
    const userResult = await pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found:', email);
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('Found user ID:', userId);
    
    // Hash new password with Better Auth's exact params
    const newHash = await hashPassword(newPassword);
    console.log('New hash:', newHash);
    
    // Verify the hash works
    const isValid = await verifyPassword(newHash, newPassword);
    console.log('Verify test:', isValid ? '✅ OK' : '❌ FAILED');
    
    // Delete ALL existing accounts for this user
    await pool.query('DELETE FROM account WHERE "userId" = $1', [userId]);
    console.log('Deleted old accounts');
    
    // Create new account with providerId 'credential'
    await pool.query(
      'INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, \'credential\', $2, $3, NOW(), NOW())',
      [randomUUID(), userId, newHash]
    );
    
    console.log('');
    console.log('✅ Password updated successfully!');
    console.log('');
    console.log('Login with:');
    console.log('  Email: ' + email);
    console.log('  Password: ' + newPassword);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixPassword();
