import { 
  Player, InsertPlayer, 
  Queue, InsertQueue, 
  Match, InsertMatch, 
  Team, InsertTeam, 
  TeamPlayer, InsertTeamPlayer,
  MatchResult, InsertMatchResult,
  VoteKick, InsertVoteKick,
  VoteKickVote, InsertVoteKickVote,
  User, InsertUser
} from "@shared/schema";

// Define the extended storage interface
export interface IStorage {
  // User methods (existing)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Player methods
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayerByDiscordId(discordId: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  
  // Queue methods
  getQueueEntry(id: number): Promise<Queue | undefined>;
  getQueueEntryByPlayerId(playerId: number): Promise<Queue | undefined>;
  createQueueEntry(entry: InsertQueue): Promise<Queue>;
  removeQueueEntry(id: number): Promise<boolean>;
  getAllQueueEntries(): Promise<Queue[]>;
  
  // Match methods
  getMatch(id: number): Promise<Match | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, updates: Partial<Match>): Promise<Match | undefined>;
  getActiveMatches(): Promise<Match[]>;
  getMatchesForPlayer(playerId: number, limit?: number): Promise<Match[]>;
  
  // Team methods
  getTeam(id: number): Promise<Team | undefined>;
  getTeamsByMatchId(matchId: number): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  
  // TeamPlayer methods
  addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer>;
  getTeamPlayers(teamId: number): Promise<TeamPlayer[]>;
  getTeamForPlayer(matchId: number, playerId: number): Promise<Team | undefined>;
  
  // MatchResult methods
  createMatchResult(result: InsertMatchResult): Promise<MatchResult>;
  getMatchResultsForMatch(matchId: number): Promise<MatchResult[]>;
  getMatchResultsForPlayer(playerId: number, limit?: number): Promise<MatchResult[]>;
  
  // VoteKick methods
  createVoteKick(voteKick: InsertVoteKick): Promise<VoteKick>;
  getVoteKick(id: number): Promise<VoteKick | undefined>;
  getActiveVoteKicksForMatch(matchId: number): Promise<VoteKick[]>;
  updateVoteKick(id: number, updates: Partial<VoteKick>): Promise<VoteKick | undefined>;
  
  // VoteKickVote methods
  createVoteKickVote(vote: InsertVoteKickVote): Promise<VoteKickVote>;
  getVoteKickVotes(voteKickId: number): Promise<VoteKickVote[]>;
  getVoteKickVoteByVoter(voteKickId: number, voterId: number): Promise<VoteKickVote | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private players: Map<number, Player>;
  private queue: Map<number, Queue>;
  private matches: Map<number, Match>;
  private teams: Map<number, Team>;
  private teamPlayers: Map<number, TeamPlayer>;
  private matchResults: Map<number, MatchResult>;
  private voteKicks: Map<number, VoteKick>;
  private voteKickVotes: Map<number, VoteKickVote>;
  
  private userIdCounter: number;
  private playerIdCounter: number;
  private queueIdCounter: number;
  private matchIdCounter: number;
  private teamIdCounter: number;
  private teamPlayerIdCounter: number;
  private matchResultIdCounter: number;
  private voteKickIdCounter: number;
  private voteKickVoteIdCounter: number;

  constructor() {
    this.users = new Map();
    this.players = new Map();
    this.queue = new Map();
    this.matches = new Map();
    this.teams = new Map();
    this.teamPlayers = new Map();
    this.matchResults = new Map();
    this.voteKicks = new Map();
    this.voteKickVotes = new Map();
    
    this.userIdCounter = 1;
    this.playerIdCounter = 1;
    this.queueIdCounter = 1;
    this.matchIdCounter = 1;
    this.teamIdCounter = 1;
    this.teamPlayerIdCounter = 1;
    this.matchResultIdCounter = 1;
    this.voteKickIdCounter = 1;
    this.voteKickVoteIdCounter = 1;
  }

  // User methods (existing)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Player methods
  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }
  
  async getPlayerByDiscordId(discordId: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(
      (player) => player.discordId === discordId
    );
  }
  
  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = this.playerIdCounter++;
    const now = new Date();
    const player: Player = { 
      ...insertPlayer, 
      id, 
      wins: 0,
      losses: 0,
      winStreak: 0,
      lossStreak: 0,
      createdAt: now,
      updatedAt: now
    };
    this.players.set(id, player);
    return player;
  }
  
  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    const player = await this.getPlayer(id);
    if (!player) return undefined;
    
    const updatedPlayer = { 
      ...player, 
      ...updates,
      updatedAt: new Date()
    };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }
  
  async getAllPlayers(): Promise<Player[]> {
    return Array.from(this.players.values());
  }
  
  // Queue methods
  async getQueueEntry(id: number): Promise<Queue | undefined> {
    return this.queue.get(id);
  }
  
  async getQueueEntryByPlayerId(playerId: number): Promise<Queue | undefined> {
    return Array.from(this.queue.values()).find(
      (entry) => entry.playerId === playerId
    );
  }
  
  async createQueueEntry(entry: InsertQueue): Promise<Queue> {
    const id = this.queueIdCounter++;
    const queueEntry: Queue = {
      ...entry,
      id,
      joinedAt: new Date()
    };
    this.queue.set(id, queueEntry);
    return queueEntry;
  }
  
  async removeQueueEntry(id: number): Promise<boolean> {
    return this.queue.delete(id);
  }
  
  async getAllQueueEntries(): Promise<Queue[]> {
    return Array.from(this.queue.values());
  }
  
  // Match methods
  async getMatch(id: number): Promise<Match | undefined> {
    return this.matches.get(id);
  }
  
  async createMatch(match: InsertMatch): Promise<Match> {
    const id = this.matchIdCounter++;
    const now = new Date();
    const newMatch: Match = {
      ...match,
      id,
      createdAt: now,
      completedAt: null
    };
    this.matches.set(id, newMatch);
    return newMatch;
  }
  
  async updateMatch(id: number, updates: Partial<Match>): Promise<Match | undefined> {
    const match = await this.getMatch(id);
    if (!match) return undefined;
    
    const updatedMatch: Match = { ...match, ...updates };
    this.matches.set(id, updatedMatch);
    return updatedMatch;
  }
  
  async getActiveMatches(): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(
      (match) => match.status === "ACTIVE" || match.status === "PENDING"
    );
  }
  
  async getMatchesForPlayer(playerId: number, limit?: number): Promise<Match[]> {
    // Find all team players entries for this player
    const playerTeams = Array.from(this.teamPlayers.values()).filter(
      (tp) => tp.playerId === playerId
    );
    
    // Get team IDs
    const teamIds = playerTeams.map(tp => tp.teamId);
    
    // Find all teams with those IDs
    const teams = Array.from(this.teams.values()).filter(
      (team) => teamIds.includes(team.id)
    );
    
    // Get match IDs
    const matchIds = teams.map(team => team.matchId);
    
    // Get matches with those IDs
    let matches = Array.from(this.matches.values()).filter(
      (match) => matchIds.includes(match.id)
    );
    
    // Sort by created date (most recent first)
    matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply limit if specified
    if (limit && limit > 0) {
      matches = matches.slice(0, limit);
    }
    
    return matches;
  }
  
  // Team methods
  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }
  
  async getTeamsByMatchId(matchId: number): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(
      (team) => team.matchId === matchId
    );
  }
  
  async createTeam(team: InsertTeam): Promise<Team> {
    const id = this.teamIdCounter++;
    const newTeam: Team = { ...team, id };
    this.teams.set(id, newTeam);
    return newTeam;
  }
  
  // TeamPlayer methods
  async addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer> {
    const id = this.teamPlayerIdCounter++;
    const newTeamPlayer: TeamPlayer = { ...teamPlayer, id };
    this.teamPlayers.set(id, newTeamPlayer);
    return newTeamPlayer;
  }
  
  async getTeamPlayers(teamId: number): Promise<TeamPlayer[]> {
    return Array.from(this.teamPlayers.values()).filter(
      (tp) => tp.teamId === teamId
    );
  }
  
  async getTeamForPlayer(matchId: number, playerId: number): Promise<Team | undefined> {
    // Get all teams for this match
    const teams = await this.getTeamsByMatchId(matchId);
    
    // For each team, check if the player is in it
    for (const team of teams) {
      const teamPlayers = await this.getTeamPlayers(team.id);
      const playerIds = teamPlayers.map(tp => tp.playerId);
      
      if (playerIds.includes(playerId)) {
        return team;
      }
    }
    
    return undefined;
  }
  
  // MatchResult methods
  async createMatchResult(result: InsertMatchResult): Promise<MatchResult> {
    const id = this.matchResultIdCounter++;
    const newResult: MatchResult = { ...result, id };
    this.matchResults.set(id, newResult);
    return newResult;
  }
  
  async getMatchResultsForMatch(matchId: number): Promise<MatchResult[]> {
    return Array.from(this.matchResults.values()).filter(
      (result) => result.matchId === matchId
    );
  }
  
  async getMatchResultsForPlayer(playerId: number, limit?: number): Promise<MatchResult[]> {
    let results = Array.from(this.matchResults.values()).filter(
      (result) => result.playerId === playerId
    );
    
    // Sort by match ID (descending, assuming higher match IDs are more recent)
    results.sort((a, b) => b.matchId - a.matchId);
    
    // Apply limit if specified
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }
    
    return results;
  }
  
  // VoteKick methods
  async createVoteKick(voteKick: InsertVoteKick): Promise<VoteKick> {
    const id = this.voteKickIdCounter++;
    const now = new Date();
    const newVoteKick: VoteKick = {
      ...voteKick,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.voteKicks.set(id, newVoteKick);
    return newVoteKick;
  }
  
  async getVoteKick(id: number): Promise<VoteKick | undefined> {
    return this.voteKicks.get(id);
  }
  
  async getActiveVoteKicksForMatch(matchId: number): Promise<VoteKick[]> {
    return Array.from(this.voteKicks.values()).filter(
      (vk) => vk.matchId === matchId && vk.status === "PENDING"
    );
  }
  
  async updateVoteKick(id: number, updates: Partial<VoteKick>): Promise<VoteKick | undefined> {
    const voteKick = await this.getVoteKick(id);
    if (!voteKick) return undefined;
    
    const updatedVoteKick: VoteKick = { 
      ...voteKick, 
      ...updates,
      updatedAt: new Date()
    };
    this.voteKicks.set(id, updatedVoteKick);
    return updatedVoteKick;
  }
  
  // VoteKickVote methods
  async createVoteKickVote(vote: InsertVoteKickVote): Promise<VoteKickVote> {
    const id = this.voteKickVoteIdCounter++;
    const newVote: VoteKickVote = {
      ...vote,
      id,
      createdAt: new Date()
    };
    this.voteKickVotes.set(id, newVote);
    return newVote;
  }
  
  async getVoteKickVotes(voteKickId: number): Promise<VoteKickVote[]> {
    return Array.from(this.voteKickVotes.values()).filter(
      (vote) => vote.voteKickId === voteKickId
    );
  }
  
  async getVoteKickVoteByVoter(voteKickId: number, voterId: number): Promise<VoteKickVote | undefined> {
    return Array.from(this.voteKickVotes.values()).find(
      (vote) => vote.voteKickId === voteKickId && vote.voterId === voterId
    );
  }
}

export const storage = new MemStorage();
