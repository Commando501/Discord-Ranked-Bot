import { exec } from 'child_process';

// Run the drizzle-kit push command
exec('npx drizzle-kit push', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing drizzle-kit push: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`drizzle-kit push stderr: ${stderr}`);
  }
  
  console.log(`drizzle-kit push stdout: ${stdout}`);
  console.log('Database migration completed successfully!');
});