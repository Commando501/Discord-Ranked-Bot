
import { pool, db } from '../server/db';

async function migrate() {
  console.log('Starting migration: Adding pendingWinningTeam field to matches table');
  
  try {
    // Connect to database using the pool directly
    const client = await pool.connect();
    
    try {
      // Check if column exists already
      const checkColumnResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'matches' AND column_name = 'pending_winning_team'
      `);
      
      if (checkColumnResult.rows.length === 0) {
        console.log('Adding pending_winning_team column to matches table');
        
        // Add the column to the matches table
        await client.query(`
          ALTER TABLE matches
          ADD COLUMN pending_winning_team TEXT NULL
        `);
        
        console.log('Successfully added pending_winning_team column to matches table');
      } else {
        console.log('Column pending_winning_team already exists in matches table');
      }
      
      console.log('Migration completed successfully');
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrate();
