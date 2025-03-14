import { Guild } from 'discord.js';
import { IStorage } from '../../storage';
import { logger } from '../utils/logger';
import { config } from '../config';
import { MatchService } from './matchService';
import { BotConfig } from '@shared/botConfig';

export class QueueService {
  private storage: IStorage;
  private matchService: MatchService;
  
  constructor(storage: IStorage) {
    this.storage = storage;
    this.matchService = new MatchService(storage);
  }
  
  async addPlayerToQueue(playerId: number): Promise<boolean> {
    // Check if player is already in queue
    const isInQueue = await this.isPlayerInQueue(playerId);
    if (isInQueue) {
      return false;
    }
    
    // Add player to queue
    await this.storage.addPlayerToQueue({
      playerId,
      priority: 0
    });
    
    logger.info(`Player ${playerId} added to queue`);
    return true;
  }
  
  async removePlayerFromQueue(playerId: number): Promise<boolean> {
    return this.storage.removePlayerFromQueue(playerId);
  }
  
  async isPlayerInQueue(playerId: number): Promise<boolean> {
    return this.storage.isPlayerInQueue(playerId);
  }
  
  async getQueuePlayers(): Promise<Array<{ playerId: number, joinedAt: Date, priority: number }>> {
    const queueEntries = await this.storage.getQueuePlayers();
    return queueEntries.map(entry => ({
      playerId: entry.playerId,
      joinedAt: entry.joinedAt,
      priority: entry.priority
    }));
  }
  
  async getQueuePlayersWithInfo(): Promise<Array<{ playerId: number, joinedAt: Date, priority: number, player: any }>> {
    return this.storage.getQueuePlayers();
  }
  
  async getQueueSize(): Promise<number> {
    const queue = await this.storage.getQueuePlayers();
    return queue.length;
  }
  
  async clearQueue(): Promise<void> {
    await this.storage.clearQueue();
    logger.info('Queue has been cleared');
  }
  
  async checkAndCreateMatch(guild: Guild, force: boolean = false): Promise<boolean> {
    try {
      const queuedPlayers = await this.storage.getQueuePlayers();
      
      if (queuedPlayers.length < config.REQUIRED_PLAYERS_PER_MATCH && !force) {
        logger.info(`Not enough players in queue to create a match: ${queuedPlayers.length}/${config.REQUIRED_PLAYERS_PER_MATCH}`);
        return false;
      }
      
      // Sort by priority and join time
      const sortedPlayers = queuedPlayers.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.joinedAt.getTime() - b.joinedAt.getTime(); // Earlier join time first
      });
      
      // Take the required number of players
      const matchPlayers = sortedPlayers
        .slice(0, config.REQUIRED_PLAYERS_PER_MATCH)
        .map(entry => entry.playerId);
      
      // Create the match
      const result = await this.matchService.createMatchWithPlayers(matchPlayers, guild);
      
      if (!result.success) {
        logger.error(`Failed to create match: ${result.message}`);
        return false;
      }
      
      // Remove players from queue
      for (const playerId of matchPlayers) {
        await this.removePlayerFromQueue(playerId);
      }
      
      logger.info(`Match created with ${matchPlayers.length} players`);
      return true;
    } catch (error) {
      logger.error(`Error checking and creating match: ${error}`);
      return false;
    }
  }
}
