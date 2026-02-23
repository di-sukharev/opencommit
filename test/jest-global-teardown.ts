const fs = require('fs');
const path = require('path');

module.exports = async function globalTeardown() {
  const envPath = path.join(process.cwd(), '.env');
  const backupPath = path.join(process.cwd(), '.env.test-backup');

  // Restore .env file
  if (fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, envPath);
    console.log('Restored .env file after testing');
  }
}
