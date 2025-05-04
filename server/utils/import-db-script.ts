
import { db } from "../db";
import fs from "fs";
import path from "path";
import { players, matches, teams, teamPlayers, queue, botConfig } from "../../shared/schema";

/**
 * Script to import database data from JSON export
 */
async function importDatabase(filePath: string) {
  try {
    console.log(`Starting database import from: ${filePath}`);
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Import file not found: ${filePath}`);
    }
    
    // Read and parse the export file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const importData = JSON.parse(fileContent);
    
    // Begin transaction to ensure data consistency
    return await db.transaction(async (tx) => {
      console.log("Clearing existing data...");
      
      // Clear existing data (in reverse order of dependencies)
      await tx.delete(queue);
      await tx.delete(teamPlayers);
      await tx.delete(teams);
      await tx.delete(matches);
      await tx.delete(players);
      await tx.delete(botConfig);
      
      console.log("Importing new data...");
      
      // Import bot config first
      if (importData.config) {
        await tx.insert(botConfig).values(importData.config);
      }
      
      // Import players
      if (importData.players && importData.players.length > 0) {
        for (const player of importData.players) {
          await tx.insert(players).values(player);
        }
        console.log(`Imported ${importData.players.length} players`);
      }
      
      // Import matches
      if (importData.matches && importData.matches.length > 0) {
        for (const match of importData.matches) {
          await tx.insert(matches).values(match);
        }
        console.log(`Imported ${importData.matches.length} matches`);
      }
      
      // Import teams
      if (importData.teams && importData.teams.length > 0) {
        for (const team of importData.teams) {
          await tx.insert(teams).values(team);
        }
        console.log(`Imported ${importData.teams.length} teams`);
      }
      
      // Import team players
      if (importData.teamPlayers && importData.teamPlayers.length > 0) {
        for (const teamPlayer of importData.teamPlayers) {
          await tx.insert(teamPlayers).values(teamPlayer);
        }
        console.log(`Imported ${importData.teamPlayers.length} team player relations`);
      }
      
      // Import queue last
      if (importData.queue && importData.queue.length > 0) {
        for (const queueEntry of importData.queue) {
          await tx.insert(queue).values(queueEntry);
        }
        console.log(`Imported ${importData.queue.length} queue entries`);
      }
      
      console.log("Database import completed successfully");
      return { success: true };
    });
  } catch (error) {
    console.error("Error importing database:", error);
    return { success: false, error };
  }
}

// Run the import if executed directly
if (require.main === module) {
  // Get file path from command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Please provide a file path: ts-node import-db-script.ts ./exports/db-export.json");
    process.exit(1);
  }
  
  importDatabase(args[0])
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

export { importDatabase };
