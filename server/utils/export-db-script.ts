
import { db } from "../db";
import fs from "fs";
import path from "path";

/**
 * Script to export all database data to JSON
 * This allows you to migrate data to another host
 */
async function exportDatabase() {
  try {
    console.log("Starting database export...");
    
    // Create exports directory if it doesn't exist
    const exportDir = path.join(process.cwd(), "exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = path.join(exportDir, `db-export-${timestamp}.json`);
    
    // Gather all data from tables
    const players = await db.query.players.findMany();
    const matches = await db.query.matches.findMany();
    const teams = await db.query.teams.findMany();
    const teamPlayers = await db.query.teamPlayers.findMany();
    const queue = await db.query.queue.findMany();
    const config = await db.query.botConfig.findFirst();
    
    // Bundle everything into a single export
    const exportData = {
      players,
      matches,
      teams,
      teamPlayers,
      queue,
      config,
      exportDate: new Date().toISOString(),
    };
    
    // Write to file
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
    
    console.log(`Database exported successfully to: ${filename}`);
    return { success: true, path: filename };
  } catch (error) {
    console.error("Error exporting database:", error);
    return { success: false, error };
  }
}

// Run the export if executed directly
if (require.main === module) {
  exportDatabase()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export { exportDatabase };
