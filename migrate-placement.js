
import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

async function main() {
  console.log('Starting migration for placement matches...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Check if the columns already exist to avoid errors
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'players' AND (
        column_name = 'placement_matches_played' OR
        column_name = 'placement_matches_complete' OR
        column_name = 'season_id'
      )
    `);
    
    const existingColumns = checkResult.rows.map(row => row.column_name);
    
    // Add placement_matches_played column if it doesn't exist
    if (!existingColumns.includes('placement_matches_played')) {
      console.log('Adding placement_matches_played column...');
      await pool.query(`
        ALTER TABLE players
        ADD COLUMN placement_matches_played INTEGER NOT NULL DEFAULT 0
      `);
      console.log('Column placement_matches_played added successfully');
    } else {
      console.log('Column placement_matches_played already exists, skipping');
    }
    
    // Add placement_matches_complete column if it doesn't exist
    if (!existingColumns.includes('placement_matches_complete')) {
      console.log('Adding placement_matches_complete column...');
      await pool.query(`
        ALTER TABLE players
        ADD COLUMN placement_matches_complete BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log('Column placement_matches_complete added successfully');
    } else {
      console.log('Column placement_matches_complete already exists, skipping');
    }
    
    // Add season_id column if it doesn't exist
    if (!existingColumns.includes('season_id')) {
      console.log('Adding season_id column...');
      await pool.query(`
        ALTER TABLE players
        ADD COLUMN season_id INTEGER NOT NULL DEFAULT 1
      `);
      console.log('Column season_id added successfully');
    } else {
      console.log('Column season_id already exists, skipping');
    }
    
    // Update existing players to mark them as having completed placements
    console.log('Updating existing players to mark placement completion based on match history...');
    
    // Get config value for required placement matches
    const botConfigResult = await pool.query(`
      SELECT value FROM config WHERE key = 'botConfig'
    `);
    
    let requiredPlacementMatches = 5; // Default value
    if (botConfigResult.rows.length > 0) {
      try {
        const botConfig = JSON.parse(botConfigResult.rows[0].value);
        requiredPlacementMatches = botConfig.mmrSystem?.placementMatches || 5;
      } catch (e) {
        console.log('Error parsing botConfig, using default value of 5 placement matches');
      }
    }
    
    console.log(`Required placement matches configured as: ${requiredPlacementMatches}`);
    
    // Calculate matches played for each player
    await pool.query(`
      WITH player_match_counts AS (
        SELECT 
          tp.player_id,
          COUNT(DISTINCT t.match_id) as matches_played
        FROM 
          team_players tp
        JOIN 
          teams t ON tp.team_id = t.id
        JOIN 
          matches m ON t.match_id = m.id
        WHERE 
          m.status = 'COMPLETED'
        GROUP BY 
          tp.player_id
      )
      UPDATE players p
      SET 
        placement_matches_played = LEAST(pmc.matches_played, $1),
        placement_matches_complete = CASE WHEN pmc.matches_played >= $1 THEN TRUE ELSE FALSE END
      FROM 
        player_match_counts pmc
      WHERE 
        p.id = pmc.player_id
    `, [requiredPlacementMatches]);
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
