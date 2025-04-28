
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import * as schema from '../../shared/schema';

/**
 * Creates a backup of the database and saves it to a file
 * @param outputDir Directory to save the backup file
 * @returns Path to the backup file
 */
export async function createDatabaseBackup(outputDir: string = './backups'): Promise<string> {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get all data from different tables
    const playersData = await db.select().from(schema.players);
    const matchesData = await db.select().from(schema.matches);
    const teamsData = await db.select().from(schema.teams);
    const teamPlayersData = await db.select().from(schema.teamPlayers);
    const queueData = await db.select().from(schema.queue);
    const matchVotesData = await db.select().from(schema.matchVotes);
    const voteKicksData = await db.select().from(schema.voteKicks);
    const voteKickVotesData = await db.select().from(schema.voteKickVotes);
    
    // Compile all data into a single object
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {
        players: playersData,
        matches: matchesData,
        teams: teamsData,
        teamPlayers: teamPlayersData,
        queue: queueData,
        matchVotes: matchVotesData,
        voteKicks: voteKicksData,
        voteKickVotes: voteKickVotesData
      }
    };
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database-backup-${timestamp}.json`;
    const filePath = path.join(outputDir, filename);
    
    // Write data to file
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    
    console.log(`Database backup created at: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error creating database backup:', error);
    throw error;
  }
}

// If this file is run directly
if (require.main === module) {
  createDatabaseBackup()
    .then(filePath => console.log(`Backup saved to: ${filePath}`))
    .catch(error => console.error('Backup failed:', error));
}
