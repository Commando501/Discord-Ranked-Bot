import { CommandInteraction, Client, Message } from 'discord.js';
import { Player, Match, Team, Queue } from '@shared/schema';

// Command handler interface
export interface Command {
  name: string;
  description: string;
  execute: (interaction: CommandInteraction, client: Client) => Promise<void>;
}

// Enhanced types for match management
export interface MatchWithTeams extends Match {
  teams: TeamWithPlayers[];
}

export interface TeamWithPlayers extends Team {
  players: Player[];
}

export interface QueueWithPlayer extends Queue {
  player: Player;
}

// Response types
export interface CommandResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface MatchCreationResult {
  success: boolean;
  message: string;
  matchId?: number;
}

export interface VoteKickResult {
  success: boolean;
  message: string;
  voteId?: number;
}

// Vote tracking
export interface ActiveVote {
  messageId: string;
  targetId: number;
  votes: {
    [userId: string]: boolean; // true = yes, false = no
  };
  requiredVotes: number;
  timeout: NodeJS.Timeout;
}

// MMR calculator
export interface MMRCalculationResult {
  playerMmr: number;
  mmrChange: number;
  newMmr: number;
}

// Match operation result
export interface MatchOperationResult {
  success: boolean;
  message: string;
}
