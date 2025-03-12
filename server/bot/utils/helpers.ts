import { Player } from '@shared/schema';

/**
 * Formats a duration from milliseconds to a readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

/**
 * Calculates balanced teams based on player MMR
 */
export function calculateTeamsMMR(players: Player[]): {
  teams: Player[][],
  team1MMR: number,
  team2MMR: number,
  mmrDifference: number
} {
  // Sort players by MMR (highest first)
  const sortedPlayers = [...players].sort((a, b) => b.mmr - a.mmr);
  
  // Give team names for reference
  const namedPlayers = sortedPlayers.map(p => ({
    ...p,
    teamName: ''
  }));
  
  // Initialize teams
  const team1: typeof namedPlayers = [];
  const team2: typeof namedPlayers = [];
  
  // Special case for 2 players (1v1)
  if (namedPlayers.length === 2) {
    namedPlayers[0].teamName = 'Alpha';
    namedPlayers[1].teamName = 'Bravo';
    
    return {
      teams: [[namedPlayers[0]], [namedPlayers[1]]],
      team1MMR: namedPlayers[0].mmr,
      team2MMR: namedPlayers[1].mmr,
      mmrDifference: Math.abs(namedPlayers[0].mmr - namedPlayers[1].mmr)
    };
  }
  
  // For more than 2 players, use a greedy approach
  // Distribute players in a "snake draft" pattern to ensure balance
  // e.g., for 6 players ranked by MMR: [1,3,5] vs [2,4,6]
  for (let i = 0; i < namedPlayers.length; i++) {
    if (i % 2 === 0) {
      namedPlayers[i].teamName = 'Alpha';
      team1.push(namedPlayers[i]);
    } else {
      namedPlayers[i].teamName = 'Bravo';
      team2.push(namedPlayers[i]);
    }
  }
  
  // Calculate average MMR for each team
  const team1MMR = Math.round(team1.reduce((sum, p) => sum + p.mmr, 0) / team1.length);
  const team2MMR = Math.round(team2.reduce((sum, p) => sum + p.mmr, 0) / team2.length);
  
  return {
    teams: [team1, team2],
    team1MMR,
    team2MMR,
    mmrDifference: Math.abs(team1MMR - team2MMR)
  };
}

/**
 * Calculates the ELO rating change
 * K is the maximum change (usually 32, 16, or 24)
 * R1 and R2 are the ratings of the players
 * S is the score (1 for win, 0.5 for draw, 0 for loss)
 */
export function calculateEloChange(playerRating: number, opponentRating: number, score: number, k: number = 32): number {
  // Calculate expected score
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  
  // Calculate rating change
  return Math.round(k * (score - expected));
}

/**
 * Generate a unique channel name for a match
 */
export function generateMatchChannelName(matchId: number): string {
  return `match-${matchId}`;
}

/**
 * Check if a string is a valid Discord ID
 */
export function isValidDiscordId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}
