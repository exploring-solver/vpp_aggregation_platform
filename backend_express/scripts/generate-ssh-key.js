import crypto from 'crypto';

/**
 * Generate a secure SSH encryption key
 * Run: node scripts/generate-ssh-key.js
 */
const key = crypto.randomBytes(32).toString('hex');
console.log('\n=== SSH Encryption Key ===');
console.log('Add this to your .env file:');
console.log(`SSH_ENCRYPTION_KEY=${key}`);
console.log('\n⚠️  Keep this key secret and never commit it to version control!\n');

