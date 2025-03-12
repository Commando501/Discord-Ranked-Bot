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
  listTopPlayers(limit: number): Promise<Player[]>;

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
  async addPlayerToQueue(queueEntry: InsertQueue): Promise<Queue> {
    try {
      const [entry] = await db.insert(queue).values(queueEntry).returning();
      return entry;
    } catch (error) {
      console.error('Error in addPlayerToQueue:', error);
      throw error;
    }
  }

  async removePlayerFromQueue(playerId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(queue)
        .where(eq(queue.playerId, playerId));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error in removePlayerFromQueue:', error);
      return false;
    }
  }

  async getQueuePlayers(): Promise<Array<Queue & { player: Player }>> {
    try {
      const queueWithPlayers = await db.query.queue.findMany({
        with: {
          player: true
        },
        orderBy: (queue, { asc }) => [asc(queue.joinedAt)]
      });
      return queueWithPlayers;
    } catch (error) {
      console.error('Error in getQueuePlayers:', error);
      return [];
    }
  }

  async isPlayerInQueue(playerId: number): Promise<boolean> {
    try {
      const [entry] = await db
        .select()
        .from(queue)
        .where(eq(queue.playerId, playerId));
      return !!entry;
    } catch (error) {
      console.error('Error in isPlayerInQueue:', error);
      return false;
    }
  }

  async clearQueue(): Promise<void> {
    try {
      await db.delete(queue);
    } catch (error) {
      console.error('Error in clearQueue:', error);
    }
  }

  // Match operations
  async createMatch(match: InsertMatch): Promise<Match> {
    try {
      const [newMatch] = await db.insert(matches).values(match).returning();
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

  async updateMatch(id: number, data: Partial<Match>): Promise<Match | undefined> {
    try {
      const [updatedMatch] = await db
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

  async getPlayerMatches(playerId: number, limit: number): Promise<Match[]> {
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
      
      const matchIds = teamResults.map(t => t.matchId);
      
      // Get match details
      const matchResults = await db
        .select()
        .from(matches)
        .where(inArray(matches.id, matchIds))
        .orderBy(desc(matches.createdAt))
        .limit(limit);
      
      return matchResults;
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
  async createTeam(team: InsertTeam): Promise<Team> {
    try {
      const [newTeam] = await db.insert(teams).values(team).returning();
      return newTeam;
    } catch (error) {
      console.error('Error in createTeam:', error);
      throw error;
    }
  }

  async getTeam(id: number): Promise<Team | undefined> {
    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, id));
      return team;
    } catch (error) {
      console.error('Error in getTeam:', error);
      return undefined;
    }
  }

  async addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<void> {
    try {
      await db.insert(teamPlayers).values(teamPlayer);
    } catch (error) {
      console.error('Error in addPlayerToTeam:', error);
      throw error;
    }
  }

  async getTeamPlayers(teamId: number): Promise<Player[]> {
    try {
      // Get all player IDs in the team
      const teamPlayerResults = await db
        .select()
        .from(teamPlayers)
        .where(eq(teamPlayers.teamId, teamId));
      
      if (teamPlayerResults.length === 0) {
        return [];
      }
      
      const playerIds = teamPlayerResults.map(tp => tp.playerId);
      
      // Get player details
      const playerResults = await db
        .select()
        .from(players)
        .where(inArray(players.id, playerIds));
      
      return playerResults;
    } catch (error) {
      console.error('Error in getTeamPlayers:', error);
      return [];
    }
  }

  async getMatchTeams(matchId: number): Promise<Array<Team & { players: Player[] }>> {
    try {
      const teamResults = await db
        .select()
        .from(teams)
        .where(eq(teams.matchId, matchId));
      
      const result: Array<Team & { players: Player[] }> = [];
      
      for (const team of teamResults) {
        const players = await this.getTeamPlayers(team.id);
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
