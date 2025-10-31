const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  const envPath = path.join(process.cwd(), '.env');
  const backupPath = path.join(process.cwd(), '.env.test-backup');

  // Backup .env file if it exists and clear related env vars
  if (fs.existsSync(envPath)) {
    fs.renameSync(envPath, backupPath);
    console.log('Backed up .env file for testing');

    // Also clear any OCO_ environment variables that might have been loaded
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('OCO_')) {
        delete process.env[key];
      }
    });
  }
}
