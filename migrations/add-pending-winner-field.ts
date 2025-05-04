
import { db } from '../server/db';

async function migrate() {
  console.log('Starting migration: Adding pendingWinningTeam field to matches table');
  
  try {
    // Check if column exists already
    const checkColumn = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'matches' AND column_name = 'pending_winning_team'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('Adding pending_winning_team column to matches table');
      
      // Add the column to the matches table
      await db.query(`
        ALTER TABLE matches
        ADD COLUMN pending_winning_team TEXT NULL
      `);
      
      console.log('Successfully added pending_winning_team column to matches table');
    } else {
      console.log('Column pending_winning_team already exists in matches table');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await db.end();
  }
}

// Run the migration
migrate();
