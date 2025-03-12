import { IStorage } from '../../storage';
import { logger } from '../utils/logger';
import { DiscordUser } from '@shared/schema';

export class PlayerService {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  async getPlayerByDiscordId(discordId: string): Promise<any | null> {
    return this.storage.getPlayerByDiscordId(discordId);
  }
  
  async ensurePlayerExists(userData: DiscordUser): Promise<any> {
    try {
      // Check if player already exists
      let player = await this.storage.getPlayerByDiscordId(userData.discordId);
      
      if (!player) {
        // Create new player
        player = await this.storage.createPlayer({
          discordId: userData.discordId,
          username: userData.username,
          discriminator: userData.discriminator,
          avatar: userData.avatar || ''
        });
        
        logger.info(`Created new player: ${userData.username}#${userData.discriminator} (${userData.discordId})`);
      }
      
      return player;
    } catch (error) {
      logger.error(`Error ensuring player exists: ${error}`);
      throw error;
    }
  }
  
  async getOrCreatePlayer(userData: DiscordUser): Promise<any> {
    return this.ensurePlayerExists(userData);
  }
  
  async updatePlayerStats(playerId: number, isWin: boolean): Promise<any> {
    try {
      const player = await this.storage.getPlayer(playerId);
      
      if (!player) {
        logger.error(`Player not found for ID: ${playerId}`);
        return null;
      }
      
      // Calculate new stats
      let mmrChange = isWin ? 25 : -20; // Basic MMR change
      let winStreak = player.winStreak;
      let lossStreak = player.lossStreak;
      
      if (isWin) {
        winStreak += 1;
        lossStreak = 0;
      } else {
        lossStreak += 1;
        winStreak = 0;
      }
      
      // Apply streak bonuses
      if (isWin && winStreak > 3) {
        mmrChange += 5 * (winStreak - 3); // Bonus for win streaks
      }
      
      // Ensure MMR doesn't go below 1
      const newMMR = Math.max(1, player.mmr + mmrChange);
      
      // Update stats
      const updatedPlayer = await this.storage.updatePlayer(playerId, {
        mmr: newMMR,
        wins: isWin ? player.wins + 1 : player.wins,
        losses: isWin ? player.losses : player.losses + 1,
        winStreak,
        lossStreak
      });
      
      return updatedPlayer;
    } catch (error) {
      logger.error(`Error updating player stats: ${error}`);
      throw error;
    }
  }
  
  async getTopPlayers(limit: number = 10): Promise<any[]> {
    try {
      return this.storage.listTopPlayers(limit);
    } catch (error) {
      logger.error(`Error getting top players: ${error}`);
      return [];
    }
  }
}
