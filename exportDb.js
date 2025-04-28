
// Database export script
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure backups directory exists
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Generate timestamp for filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = path.join(backupsDir, `database-backup-${timestamp}.sql`);

// Get DATABASE_URL from environment
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

try {
  // Use pg_dump to create a SQL dump of the database
  console.log('Exporting database...');
  
  // Parse connection string to get components
  const url = new URL(process.env.DATABASE_URL);
  const host = url.hostname;
  const port = url.port;
  const database = url.pathname.substring(1);
  const username = url.username;
  
  // Build the pg_dump command
  const pgDumpCmd = `PGPASSWORD=${url.password} pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F c -f ${outputFile}`;
  
  // Execute the command
  execSync(pgDumpCmd, { stdio: 'inherit' });
  
  console.log(`Database exported successfully to: ${outputFile}`);
} catch (error) {
  console.error('Error exporting database:', error);
  console.error('If pg_dump is not available, you can use the JavaScript backup method:');
  console.error('node -e "require(\'./server/utils/dbBackup\').createDatabaseBackup()"');
}
