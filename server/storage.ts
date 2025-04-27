import fs from 'fs';
import path from 'path';
import { eq, and, or, desc, inArray } from 'drizzle-orm';
import {
  Player, InsertPlayer,
  Queue, InsertQueue,
  Match, InsertMatch,
  Team, InsertTeam,
  TeamPlayer, InsertTeamPlayer,
  MatchVote, InsertMatchVote,
  VoteKick, InsertVoteKick,
  VoteKickVote, InsertVoteKickVote,
  DiscordUser,
  players, queue, matches, teams, teamPlayers, matchVotes, voteKicks, voteKickVotes
} from "@shared/schema";
import { defaultBotConfig, BotConfig } from "@shared/botConfig";
import { defaultRankTiers, RankTier } from "@shared/rankSystem";
import { db } from './db';

// Path to the configuration file
const CONFIG_FILE_PATH = path.join(process.cwd(), 'discordbot-config.json');

// Storage interface
export interface IStorage {
  // Player operations
  getPlayerByDiscordId(discordId: string): Promise<Player | undefined>;
  getPlayer(id: number): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, data: Partial<Player>): Promise<Player | undefined>;
  deletePlayer(id: number): Promise<boolean>;
  listTopPlayers(limit: number): Promise<Player[]>;
  getRankTiers(): Promise<RankTier[]>;
  getPlayerRank(mmr: number, tiers: RankTier[]): Promise<RankTier>;

  // Queue operations
  addPlayerToQueue(queueEntry: InsertQueue): Promise<Queue>;
  removePlayerFromQueue(playerId: number): Promise<boolean>;
  getQueuePlayers(): Promise<Array<Queue & { player: Player }>>;
  isPlayerInQueue(playerId: number): Promise<boolean>;
  clearQueue(): Promise<void>;

  // Match operations
  createMatch(match: InsertMatch): Promise<Match>;
  getMatch(id: number): Promise<Match | undefined>;
  getActiveMatches(): Promise<Array<Match & { teams: Array<Team & { players: Player[] }> }>>;
  updateMatch(id: number, data: Partial<Match>): Promise<Match | undefined>;
  getPlayerMatches(playerId: number, limit: number): Promise<Match[]>;
  getMatchHistory(limit: number): Promise<Array<Match & { teams: Team[] }>>;

  // Team operations
  createTeam(team: InsertTeam): Promise<Team>;
  getTeam(id: number): Promise<Team | undefined>;
  addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<void>;
  getTeamPlayers(teamId: number): Promise<Player[]>;
  getMatchTeams(matchId: number): Promise<Array<Team & { players: Player[] }>>;

  // Vote operations
  addMatchVote(vote: InsertMatchVote): Promise<MatchVote>;
  getMatchVotes(matchId: number): Promise<MatchVote[]>;
  
  // Vote kick operations
  createVoteKick(voteKick: InsertVoteKick): Promise<VoteKick>;
  getVoteKick(id: number): Promise<VoteKick | undefined>;
  getActiveVoteKick(matchId: number, targetPlayerId: number): Promise<VoteKick | undefined>;
  addVoteKickVote(vote: InsertVoteKickVote): Promise<VoteKickVote>;
  getVoteKickVotes(voteKickId: number): Promise<VoteKickVote[]>;
  updateVoteKick(id: number, data: Partial<VoteKick>): Promise<VoteKick | undefined>;
  
  // Bot configuration operations
  getBotConfig(): Promise<BotConfig>;
  updateBotConfig(config: BotConfig): Promise<BotConfig>;
}

/**
 * Helper functions for file-based configuration
 */

// Load configuration from file, or create it if it doesn't exist
function loadConfigFromFile(): BotConfig {
  try {
    // Check if file exists
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      // Read and parse the file
      const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      const config = JSON.parse(fileContent);
      console.log('[CONFIG] Loaded configuration from file');
      return config;
    } else {
      // Create file with default config
      saveConfigToFile(defaultBotConfig);
      console.log('[CONFIG] Created new configuration file with defaults');
      return defaultBotConfig;
    }
  } catch (error) {
    console.error('[CONFIG] Error loading configuration file:', error);
    return defaultBotConfig;
  }
}

// Save configuration to file
function saveConfigToFile(config: BotConfig): void {
  try {
    const configJson = JSON.stringify(config, null, 2); // Pretty print with 2 spaces
    fs.writeFileSync(CONFIG_FILE_PATH, configJson, 'utf8');
    console.log('[CONFIG] Saved configuration to file');
  } catch (error) {
    console.error('[CONFIG] Error saving configuration to file:', error);
  }
}

// Update specific section of configuration
function updateConfigSection(currentConfig: BotConfig, section: string, sectionConfig: any): BotConfig {
  if (!Object.keys(currentConfig).includes(section)) {
    console.error(`[CONFIG] Unknown section: ${section}`);
    return currentConfig;
  }
  
  return {
    ...currentConfig,
    [section]: sectionConfig
  };
}

export class DatabaseStorage implements IStorage {
  private botConfig: BotConfig;
  
  constructor() {
    // Load bot config from file or initialize with defaults
    this.botConfig = loadConfigFromFile();
  }

  // Player operations
  async getPlayerByDiscordId(discordId: string): Promise<Player | undefined> {
    try {
      const [player] = await db.select().from(players).where(eq(players.discordId, discordId));
      return player;
    } catch (error) {
      console.error('Error in getPlayerByDiscordId:', error);
      return undefined;
    }
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    try {
      const [player] = await db.select().from(players).where(eq(players.id, id));
      return player;
    } catch (error) {
      console.error('Error in getPlayer:', error);
      return undefined;
    }
  }

  async createPlayer(playerData: InsertPlayer): Promise<Player> {
    try {
      const [player] = await db.insert(players).values(playerData).returning();
      return player;
    } catch (error) {
      console.error('Error in createPlayer:', error);
      throw error;
    }
  }

  async updatePlayer(id: number, data: Partial<Player>): Promise<Player | undefined> {
    try {
      const [updatedPlayer] = await db
        .update(players)
        .set(data)
        .where(eq(players.id, id))
        .returning();
      return updatedPlayer;
    } catch (error) {
      console.error('Error in updatePlayer:', error);
      return undefined;
    }
  }
  
  async deletePlayer(id: number): Promise<boolean> {
    try {
      // First, delete any references to this player in related tables
      // Remove from match_votes
      await db
        .delete(matchVotes)
        .where(eq(matchVotes.playerId, id));
        
      // Remove from voteKick votes
      await db
        .delete(voteKickVotes)
        .where(eq(voteKickVotes.playerId, id));
        
      // Remove from voteKicks (as target and initiator)
      await db
        .delete(voteKicks)
        .where(
          or(
            eq(voteKicks.targetPlayerId, id),
            eq(voteKicks.initiatorPlayerId, id)
          )
        );
        
      // Remove from team_players (team memberships)
      await db
        .delete(teamPlayers)
        .where(eq(teamPlayers.playerId, id));
        
      // Remove from queue if they're in it
      await db
        .delete(queue)
        .where(eq(queue.playerId, id));
        
      // Finally delete the player
      await db
        .delete(players)
        .where(eq(players.id, id));
      
      return true;
    } catch (error) {
      console.error('Error in deletePlayer:', error);
      return false;
    }
  }

  async listTopPlayers(limit: number): Promise<Player[]> {
    try {
      console.log(`Fetched ${limit} top players`);
      const topPlayers = await db
        .select()
        .from(players)
        .where(eq(players.isActive, true))
        .orderBy(desc(players.mmr))
        .limit(limit);
      return topPlayers;
    } catch (error) {
      console.error('Error in listTopPlayers:', error);
      return [];
    }
  }

  // Queue operations
  async addPlayerToQueue(queueEntry: InsertQueue, tx?: typeof db): Promise<Queue> {
    try {
      const dbClient = tx || db;
      const [entry] = await dbClient.insert(queue).values(queueEntry).returning();
      return entry;
    } catch (error) {
      console.error('Error in addPlayerToQueue:', error);
      throw error;
    }
  }

  async removePlayerFromQueue(playerId: number, tx?: typeof db): Promise<boolean> {
    try {
      const dbClient = tx || db;
      // First check if the player is in the queue
      const [entry] = await dbClient
        .select()
        .from(queue)
        .where(eq(queue.playerId, playerId));
      
      if (!entry) {
        return false;
      }
      
      // Delete the entry
      await dbClient
        .delete(queue)
        .where(eq(queue.playerId, playerId));
      
      return true;
    } catch (error) {
      console.error('Error in removePlayerFromQueue:', error);
      return false;
    }
  }

  async getQueuePlayers(tx?: typeof db): Promise<Array<Queue & { player: Player }>> {
    try {
      const dbClient = tx || db;
      
      // Use the query builder directly since the relations functionality isn't 
      // directly available with the transaction object in the same way
      if (tx) {
        const queueEntries = await dbClient.select().from(queue).orderBy(queue.joinedAt);
        // If we have queue entries, fetch the related players
        if (queueEntries.length > 0) {
          const playerIds = queueEntries.map(entry => entry.playerId);
          const playersResult = await dbClient
            .select()
            .from(players)
            .where(inArray(players.id, playerIds));
          
          // Create a map of player IDs to player objects
          const playerMap = new Map();
          playersResult.forEach(player => {
            playerMap.set(player.id, player);
          });
          
          // Join the players with their queue entries
          return queueEntries.map(entry => ({
            ...entry,
            player: playerMap.get(entry.playerId)
          }));
        }
        return [];
      } else {
        // Use the relation query if we're not in a transaction
        const queueWithPlayers = await db.query.queue.findMany({
          with: {
            player: true
          },
          orderBy: (queue, { asc }) => [asc(queue.joinedAt)]
        });
        return queueWithPlayers;
      }
    } catch (error) {
      console.error('Error in getQueuePlayers:', error);
      return [];
    }
  }

  async isPlayerInQueue(playerId: number, tx?: typeof db): Promise<boolean> {
    try {
      const dbClient = tx || db;
      const [entry] = await dbClient
        .select()
        .from(queue)
        .where(eq(queue.playerId, playerId));
      return !!entry;
    } catch (error) {
      console.error('Error in isPlayerInQueue:', error);
      return false;
    }
  }

  async clearQueue(tx?: typeof db): Promise<void> {
    try {
      const dbClient = tx || db;
      await dbClient.delete(queue);
    } catch (error) {
      console.error('Error in clearQueue:', error);
    }
  }

  // Match operations
  async createMatch(match: InsertMatch, tx?: typeof db): Promise<Match> {
    try {
      const dbClient = tx || db;
      const [newMatch] = await dbClient.insert(matches).values(match).returning();
      return newMatch;
    } catch (error) {
      console.error('Error in createMatch:', error);
      throw error;
    }
  }

  async getMatch(id: number): Promise<Match | undefined> {
    try {
      const [match] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, id));
      return match;
    } catch (error) {
      console.error('Error in getMatch:', error);
      return undefined;
    }
  }

  async getActiveMatches(): Promise<Array<Match & { teams: Array<Team & { players: Player[] }> }>> {
    try {
      const activeMatchesResult = await db
        .select()
        .from(matches)
        .where(
          or(
            eq(matches.status, 'WAITING'),
            eq(matches.status, 'ACTIVE')
          )
        );
      
      const result: Array<Match & { teams: Array<Team & { players: Player[] }> }> = [];
      
      for (const match of activeMatchesResult) {
        const matchTeams = await this.getMatchTeams(match.id);
        result.push({
          ...match,
          teams: matchTeams
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in getActiveMatches:', error);
      return [];
    }
  }

  async updateMatch(id: number, data: Partial<Match>, tx?: typeof db): Promise<Match | undefined> {
    try {
      const dbClient = tx || db;
      const [updatedMatch] = await dbClient
        .update(matches)
        .set(data)
        .where(eq(matches.id, id))
        .returning();
      return updatedMatch;
    } catch (error) {
      console.error('Error in updateMatch:', error);
      return undefined;
    }
  }

  async getPlayerMatches(playerId: number, limit: number): Promise<Array<Match & { playerTeamId?: number, playerTeamName?: string, mmrChange?: number }>> {
    try {
      // Find all teams the player is in
      const playerTeamResults = await db
        .select()
        .from(teamPlayers)
        .where(eq(teamPlayers.playerId, playerId));
      
      if (playerTeamResults.length === 0) {
        return [];
      }
      
      const teamIds = playerTeamResults.map(tp => tp.teamId);
      
      // Find all matches associated with these teams
      const teamResults = await db
        .select()
        .from(teams)
        .where(inArray(teams.id, teamIds));
      
      if (teamResults.length === 0) {
        return [];
      }
      
      // Create a map of teamId to team info for quick lookups
      const teamMap = new Map();
      teamResults.forEach(team => {
        teamMap.set(team.id, {
          id: team.id,
          name: team.name,
          matchId: team.matchId
        });
      });
      
      // Create a map of playerId to teamId for quick lookups
      const playerTeamMap = new Map();
      playerTeamResults.forEach(tp => {
        playerTeamMap.set(tp.teamId, true);
      });
      
      const matchIds = teamResults.map(t => t.matchId);
      
      // Get match details
      const matchResults = await db
        .select()
        .from(matches)
        .where(inArray(matches.id, matchIds))
        .orderBy(desc(matches.createdAt))
        .limit(limit);
      
      // Add team info to each match and calculate MMR changes more accurately
      return Promise.all(matchResults.map(async match => {
        // Find the team in this match that the player was in
        const playerTeam = teamResults.find(team => 
          team.matchId === match.id && playerTeamMap.has(team.id)
        );
        
        // Variables to calculate MMR change
        let mmrChange;
        
        // Only calculate MMR change for completed matches
        if (match.status === "COMPLETED" && match.winningTeamId) {
          try {
            // Use the already loaded botConfig instead of querying the database
            const kFactor = this.botConfig?.mmrSystem?.kFactor || 32; // Default to 32 if not configured
            
            const didWin = playerTeam && playerTeam.id === match.winningTeamId;
            
            // Get the player's data before and after the match to calculate exact MMR change
            // This is more accurate than estimating with a formula
            
            // First try to find the actual player data
            const player = await this.getPlayer(playerId);
            
            if (didWin) {
              // Winners gain MMR - use simplified calculation similar to matchService
              mmrChange = Math.round(kFactor * 0.75);
              
              // Apply streak bonuses if we can determine them
              if (player && player.winStreak > 0) {
                const streakThreshold = this.botConfig?.mmrSystem?.streakSettings?.threshold || 3;
                const bonusPerWin = this.botConfig?.mmrSystem?.streakSettings?.bonusPerWin || 2;
                
                // Check if we're above the streak threshold (accounting for the fact this might not be the most recent match)
                if (player.winStreak >= streakThreshold) {
                  const streakBonus = Math.min(
                    this.botConfig?.mmrSystem?.streakSettings?.maxBonus || 10,
                    Math.floor((player.winStreak - streakThreshold + 1) * bonusPerWin)
                  );
                  mmrChange += streakBonus;
                }
              }
            } else if (match.winningTeamId) {
              // Losers lose MMR
              mmrChange = -Math.round(kFactor * 0.625);
              
              // Apply streak penalties if we can determine them
              if (player && player.lossStreak > 0) {
                const lossThreshold = this.botConfig?.mmrSystem?.streakSettings?.lossThreshold || 3;
                const penaltyPerLoss = this.botConfig?.mmrSystem?.streakSettings?.penaltyPerLoss || 1;
                
                // Check if we're above the loss streak threshold
                if (player.lossStreak >= lossThreshold) {
                  const streakPenalty = Math.min(
                    this.botConfig?.mmrSystem?.streakSettings?.maxLossPenalty || 5,
                    Math.floor((player.lossStreak - lossThreshold + 1) * penaltyPerLoss)
                  );
                  mmrChange -= streakPenalty;
                }
              }
            }
          } catch (error) {
            console.error('Error calculating MMR change:', error);
          }
        }
        
        if (playerTeam) {
          return {
            ...match,
            playerTeamId: playerTeam.id,
            playerTeamName: playerTeam.name,
            mmrChange: mmrChange
          };
        }
        
        return match;
      }));
    } catch (error) {
      console.error('Error in getPlayerMatches:', error);
      return [];
    }
  }

  async getMatchHistory(limit: number): Promise<Array<Match & { teams: Team[] }>> {
    try {
      const completedMatchesResult = await db
        .select()
        .from(matches)
        .where(eq(matches.status, 'COMPLETED'))
        .orderBy(desc(matches.createdAt))
        .limit(limit);
      
      const result: Array<Match & { teams: Team[] }> = [];
      
      for (const match of completedMatchesResult) {
        const teamResults = await db
          .select()
          .from(teams)
          .where(eq(teams.matchId, match.id));
        
        result.push({
          ...match,
          teams: teamResults
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in getMatchHistory:', error);
      return [];
    }
  }

  // Team operations
  async createTeam(team: InsertTeam, tx?: typeof db): Promise<Team> {
    try {
      const dbClient = tx || db;
      const [newTeam] = await dbClient.insert(teams).values(team).returning();
      return newTeam;
    } catch (error) {
      console.error('Error in createTeam:', error);
      throw error;
    }
  }

  async getTeam(id: number, tx?: typeof db): Promise<Team | undefined> {
    try {
      const dbClient = tx || db;
      const [team] = await dbClient
        .select()
        .from(teams)
        .where(eq(teams.id, id));
      return team;
    } catch (error) {
      console.error('Error in getTeam:', error);
      return undefined;
    }
  }

  async addPlayerToTeam(teamPlayer: InsertTeamPlayer, tx?: typeof db): Promise<void> {
    try {
      const dbClient = tx || db;
      await dbClient.insert(teamPlayers).values(teamPlayer);
    } catch (error) {
      console.error('Error in addPlayerToTeam:', error);
      throw error;
    }
  }

  async getTeamPlayers(teamId: number, tx?: typeof db): Promise<Player[]> {
    try {
      const dbClient = tx || db;
      // Get all player IDs in the team
      const teamPlayerResults = await dbClient
        .select()
        .from(teamPlayers)
        .where(eq(teamPlayers.teamId, teamId));
      
      if (teamPlayerResults.length === 0) {
        return [];
      }
      
      const playerIds = teamPlayerResults.map(tp => tp.playerId);
      
      // Get player details
      const playerResults = await dbClient
        .select()
        .from(players)
        .where(inArray(players.id, playerIds));
      
      return playerResults;
    } catch (error) {
      console.error('Error in getTeamPlayers:', error);
      return [];
    }
  }

  async getMatchTeams(matchId: number, tx?: typeof db): Promise<Array<Team & { players: Player[] }>> {
    try {
      const dbClient = tx || db;
      const teamResults = await dbClient
        .select()
        .from(teams)
        .where(eq(teams.matchId, matchId));
      
      const result: Array<Team & { players: Player[] }> = [];
      
      for (const team of teamResults) {
        const players = await this.getTeamPlayers(team.id, tx);
        result.push({
          ...team,
          players
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in getMatchTeams:', error);
      return [];
    }
  }

  // Vote operations
  async addMatchVote(vote: InsertMatchVote): Promise<MatchVote> {
    try {
      const [newVote] = await db.insert(matchVotes).values(vote).returning();
      return newVote;
    } catch (error) {
      console.error('Error in addMatchVote:', error);
      throw error;
    }
  }

  async getMatchVotes(matchId: number): Promise<MatchVote[]> {
    try {
      const votes = await db
        .select()
        .from(matchVotes)
        .where(eq(matchVotes.matchId, matchId));
      return votes;
    } catch (error) {
      console.error('Error in getMatchVotes:', error);
      return [];
    }
  }
  
  // Vote kick operations
  async createVoteKick(voteKick: InsertVoteKick): Promise<VoteKick> {
    try {
      const [newVoteKick] = await db.insert(voteKicks).values(voteKick).returning();
      return newVoteKick;
    } catch (error) {
      console.error('Error in createVoteKick:', error);
      throw error;
    }
  }

  async getVoteKick(id: number): Promise<VoteKick | undefined> {
    try {
      const [voteKick] = await db
        .select()
        .from(voteKicks)
        .where(eq(voteKicks.id, id));
      return voteKick;
    } catch (error) {
      console.error('Error in getVoteKick:', error);
      return undefined;
    }
  }

  async getActiveVoteKick(matchId: number, targetPlayerId: number): Promise<VoteKick | undefined> {
    try {
      const [voteKick] = await db
        .select()
        .from(voteKicks)
        .where(
          and(
            eq(voteKicks.matchId, matchId),
            eq(voteKicks.targetPlayerId, targetPlayerId),
            eq(voteKicks.status, 'PENDING')
          )
        );
      return voteKick;
    } catch (error) {
      console.error('Error in getActiveVoteKick:', error);
      return undefined;
    }
  }

  async addVoteKickVote(vote: InsertVoteKickVote): Promise<VoteKickVote> {
    try {
      const [newVote] = await db.insert(voteKickVotes).values(vote).returning();
      return newVote;
    } catch (error) {
      console.error('Error in addVoteKickVote:', error);
      throw error;
    }
  }

  async getVoteKickVotes(voteKickId: number): Promise<VoteKickVote[]> {
    try {
      const votes = await db
        .select()
        .from(voteKickVotes)
        .where(eq(voteKickVotes.voteKickId, voteKickId));
      return votes;
    } catch (error) {
      console.error('Error in getVoteKickVotes:', error);
      return [];
    }
  }

  async updateVoteKick(id: number, data: Partial<VoteKick>): Promise<VoteKick | undefined> {
    try {
      const [updatedVoteKick] = await db
        .update(voteKicks)
        .set(data)
        .where(eq(voteKicks.id, id))
        .returning();
      return updatedVoteKick;
    } catch (error) {
      console.error('Error in updateVoteKick:', error);
      return undefined;
    }
  }
  
  // Bot configuration operations
  async getRankTiers(): Promise<RankTier[]> {
    try {
      // For now, we'll return default rank tiers since the actual DB implementation
      // for rank tiers is not available in the current codebase
      // This can be extended later to read from a database table
      return this.botConfig.rankTiers || defaultRankTiers;
    } catch (error) {
      console.error('Error in getRankTiers:', error);
      return defaultRankTiers;
    }
  }
  
  async getPlayerRank(mmr: number, tiers: RankTier[]): Promise<RankTier> {
    // Import the getPlayerRank function from the rankSystem module
    const { getPlayerRank } = require('@shared/rankSystem');
    return getPlayerRank(mmr, tiers);
  }

  async getBotConfig(): Promise<BotConfig> {
    return this.botConfig;
  }
  
  async updateBotConfig(config: BotConfig): Promise<BotConfig> {
    this.botConfig = config;
    
    // Save to file
    saveConfigToFile(config);
    
    return this.botConfig;
  }
}

export const storage = new DatabaseStorage();
