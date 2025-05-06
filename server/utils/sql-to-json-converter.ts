
import fs from 'fs';
import path from 'path';
import { pool } from '../db';

/**
 * Converts a SQL dump file to the JSON format used by the import script
 * This allows using SQL exports with the JSON import system
 */
export async function convertSqlToJson(sqlFilePath: string): Promise<string> {
  try {
    console.log(`Converting SQL file to JSON format: ${sqlFilePath}`);
    
    // Validate input file exists
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }
    
    // First, import the SQL file into the database using a temporary connection
    // This is necessary because we need to read the actual data from the database
    const tempDbName = `temp_conversion_${Date.now()}`;
    
    console.log("Creating temporary database for conversion...");
    await pool.query(`CREATE DATABASE ${tempDbName}`);
    
    try {
      // Read SQL file content
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
      
      // Create a new connection to the temp database
      const connectionString = process.env.DATABASE_URL?.replace(/\/[^/]+$/, `/${tempDbName}`);
      const tempPool = new Pool({ connectionString });
      
      // Import SQL into temp database
      console.log("Importing SQL into temporary database...");
      await tempPool.query(sqlContent);
      
      // Query all the tables we need
      console.log("Extracting data from temporary database...");
      const players = await tempPool.query("SELECT * FROM players");
      const matches = await tempPool.query("SELECT * FROM matches");
      const teams = await tempPool.query("SELECT * FROM teams");
      const teamPlayers = await tempPool.query("SELECT * FROM team_players");
      const queue = await tempPool.query("SELECT * FROM queue");
      const config = await tempPool.query("SELECT * FROM bot_config LIMIT 1");
      
      // Create the JSON export format
      const exportData = {
        players: players.rows,
        matches: matches.rows,
        teams: teams.rows,
        teamPlayers: teamPlayers.rows,
        queue: queue.rows,
        config: config.rows[0] || null,
        exportDate: new Date().toISOString(),
        conversionSource: path.basename(sqlFilePath)
      };
      
      // Generate output filename
      const jsonFilePath = sqlFilePath.replace(/\.sql$/, '.json');
      
      // Write the JSON file
      fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2));
      console.log(`Conversion complete. JSON file saved as: ${jsonFilePath}`);
      
      return jsonFilePath;
    } finally {
      // Clean up - drop the temporary database
      console.log("Cleaning up temporary database...");
      await pool.query(`DROP DATABASE IF EXISTS ${tempDbName}`);
    }
  } catch (error) {
    console.error("Error converting SQL to JSON:", error);
    throw error;
  }
}

// Run the converter if executed directly
if (require.main === module) {
  // Get file path from command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Please provide a file path: ts-node sql-to-json-converter.ts ./exports/db-export.sql");
    process.exit(1);
  }
  
  convertSqlToJson(args[0])
    .then((outputPath) => {
      console.log(`Conversion successful: ${outputPath}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
