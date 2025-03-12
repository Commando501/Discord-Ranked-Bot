import {
  Player, InsertPlayer,
  Queue, InsertQueue,
  Match, InsertMatch,
  Team, InsertTeam,
  TeamPlayer, InsertTeamPlayer,
  MatchVote, InsertMatchVote,
  VoteKick, InsertVoteKick,
  VoteKickVote, InsertVoteKickVote,
  DiscordUser
} from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private players: Map<number, Player>;
  private queue: Map<number, Queue>;
  private matches: Map<number, Match>;
  private teams: Map<number, Team>;
  private teamPlayers: Array<TeamPlayer>;
  private matchVotes: Map<number, MatchVote>;
  private voteKicks: Map<number, VoteKick>;
  private voteKickVotes: Map<number, VoteKickVote>;
  
  private playerIdCounter: number;
  private queueIdCounter: number;
  private matchIdCounter: number;
  private teamIdCounter: number;
  private matchVoteIdCounter: number;
  private voteKickIdCounter: number;
  private voteKickVoteIdCounter: number;

  constructor() {
    this.players = new Map();
    this.queue = new Map();
    this.matches = new Map();
    this.teams = new Map();
    this.teamPlayers = [];
    this.matchVotes = new Map();
    this.voteKicks = new Map();
    this.voteKickVotes = new Map();
    
    this.playerIdCounter = 1;
    this.queueIdCounter = 1;
    this.matchIdCounter = 1;
    this.teamIdCounter = 1;
    this.matchVoteIdCounter = 1;
    this.voteKickIdCounter = 1;
    this.voteKickVoteIdCounter = 1;
  }

  // Player operations
  async getPlayerByDiscordId(discordId: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(
      (player) => player.discordId === discordId
    );
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async createPlayer(playerData: InsertPlayer): Promise<Player> {
    const id = this.playerIdCounter++;
    const player: Player = {
      ...playerData,
      id,
      mmr: 1000,
      wins: 0,
      losses: 0,
      winStreak: 0,
      lossStreak: 0,
      isActive: true,
      createdAt: new Date()
    };
    this.players.set(id, player);
    return player;
  }

  async updatePlayer(id: number, data: Partial<Player>): Promise<Player | undefined> {
    const player = this.players.get(id);
    if (!player) return undefined;
    
    const updatedPlayer = { ...player, ...data };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  async listTopPlayers(limit: number): Promise<Player[]> {
    return Array.from(this.players.values())
      .sort((a, b) => b.mmr - a.mmr)
      .slice(0, limit);
  }

  // Queue operations
  async addPlayerToQueue(queueEntry: InsertQueue): Promise<Queue> {
    const id = this.queueIdCounter++;
    const entry: Queue = {
      ...queueEntry,
      id,
      joinedAt: new Date()
    };
    this.queue.set(id, entry);
    return entry;
  }

  async removePlayerFromQueue(playerId: number): Promise<boolean> {
    for (const [id, entry] of this.queue.entries()) {
      if (entry.playerId === playerId) {
        this.queue.delete(id);
        return true;
      }
    }
    return false;
  }

  async getQueuePlayers(): Promise<Array<Queue & { player: Player }>> {
    const result: Array<Queue & { player: Player }> = [];
    
    for (const queueEntry of this.queue.values()) {
      const player = this.players.get(queueEntry.playerId);
      if (player) {
        result.push({
          ...queueEntry,
          player
        });
      }
    }
    
    return result.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  }

  async isPlayerInQueue(playerId: number): Promise<boolean> {
    for (const entry of this.queue.values()) {
      if (entry.playerId === playerId) {
        return true;
      }
    }
    return false;
  }

  async clearQueue(): Promise<void> {
    this.queue.clear();
  }

  // Match operations
  async createMatch(match: InsertMatch): Promise<Match> {
    const id = this.matchIdCounter++;
    const newMatch: Match = {
      ...match,
      id,
      createdAt: new Date(),
      finishedAt: null,
      winningTeamId: null
    };
    this.matches.set(id, newMatch);
    return newMatch;
  }

  async getMatch(id: number): Promise<Match | undefined> {
    return this.matches.get(id);
  }

  async getActiveMatches(): Promise<Array<Match & { teams: Array<Team & { players: Player[] }> }>> {
    const activeMatches = Array.from(this.matches.values())
      .filter(match => match.status === 'WAITING' || match.status === 'ACTIVE');
    
    const result: Array<Match & { teams: Array<Team & { players: Player[] }> }> = [];
    
    for (const match of activeMatches) {
      const matchTeams = await this.getMatchTeams(match.id);
      result.push({
        ...match,
        teams: matchTeams
      });
    }
    
    return result;
  }

  async updateMatch(id: number, data: Partial<Match>): Promise<Match | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;
    
    const updatedMatch = { ...match, ...data };
    this.matches.set(id, updatedMatch);
    return updatedMatch;
  }

  async getPlayerMatches(playerId: number, limit: number): Promise<Match[]> {
    // Find all teams the player is in
    const playerTeams = this.teamPlayers
      .filter(tp => tp.playerId === playerId)
      .map(tp => tp.teamId);
    
    // Find matches where the player's teams participated
    const matchIds = new Set<number>();
    for (const team of this.teams.values()) {
      if (playerTeams.includes(team.id)) {
        matchIds.add(team.matchId);
      }
    }
    
    // Get the actual match objects
    const playerMatches = Array.from(matchIds)
      .map(id => this.matches.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return playerMatches.slice(0, limit);
  }

  async getMatchHistory(limit: number): Promise<Array<Match & { teams: Team[] }>> {
    const completedMatches = Array.from(this.matches.values())
      .filter(match => match.status === 'COMPLETED')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    
    const result: Array<Match & { teams: Team[] }> = [];
    
    for (const match of completedMatches) {
      const matchTeams = Array.from(this.teams.values())
        .filter(team => team.matchId === match.id);
      
      result.push({
        ...match,
        teams: matchTeams
      });
    }
    
    return result;
  }

  // Team operations
  async createTeam(team: InsertTeam): Promise<Team> {
    const id = this.teamIdCounter++;
    const newTeam: Team = {
      ...team,
      id
    };
    this.teams.set(id, newTeam);
    return newTeam;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<void> {
    this.teamPlayers.push(teamPlayer);
  }

  async getTeamPlayers(teamId: number): Promise<Player[]> {
    const playerIds = this.teamPlayers
      .filter(tp => tp.teamId === teamId)
      .map(tp => tp.playerId);
    
    return playerIds
      .map(id => this.players.get(id)!)
      .filter(Boolean);
  }

  async getMatchTeams(matchId: number): Promise<Array<Team & { players: Player[] }>> {
    const teams = Array.from(this.teams.values())
      .filter(team => team.matchId === matchId);
    
    const result: Array<Team & { players: Player[] }> = [];
    
    for (const team of teams) {
      const players = await this.getTeamPlayers(team.id);
      result.push({
        ...team,
        players
      });
    }
    
    return result;
  }

  // Vote operations
  async addMatchVote(vote: InsertMatchVote): Promise<MatchVote> {
    const id = this.matchVoteIdCounter++;
    const newVote: MatchVote = {
      ...vote,
      id,
      createdAt: new Date()
    };
    this.matchVotes.set(id, newVote);
    return newVote;
  }

  async getMatchVotes(matchId: number): Promise<MatchVote[]> {
    return Array.from(this.matchVotes.values())
      .filter(vote => vote.matchId === matchId);
  }
  
  // Vote kick operations
  async createVoteKick(voteKick: InsertVoteKick): Promise<VoteKick> {
    const id = this.voteKickIdCounter++;
    const newVoteKick: VoteKick = {
      ...voteKick,
      id,
      createdAt: new Date(),
      finishedAt: null
    };
    this.voteKicks.set(id, newVoteKick);
    return newVoteKick;
  }

  async getVoteKick(id: number): Promise<VoteKick | undefined> {
    return this.voteKicks.get(id);
  }

  async getActiveVoteKick(matchId: number, targetPlayerId: number): Promise<VoteKick | undefined> {
    return Array.from(this.voteKicks.values())
      .find(vk => 
        vk.matchId === matchId && 
        vk.targetPlayerId === targetPlayerId && 
        vk.status === 'PENDING'
      );
  }

  async addVoteKickVote(vote: InsertVoteKickVote): Promise<VoteKickVote> {
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
    return Array.from(this.voteKickVotes.values())
      .filter(vote => vote.voteKickId === voteKickId);
  }

  async updateVoteKick(id: number, data: Partial<VoteKick>): Promise<VoteKick | undefined> {
    const voteKick = this.voteKicks.get(id);
    if (!voteKick) return undefined;
    
    const updatedVoteKick = { ...voteKick, ...data };
    this.voteKicks.set(id, updatedVoteKick);
    return updatedVoteKick;
  }
}

export const storage = new MemStorage();
