// Configuration for the Discord bot
export const config = {
  // Bot authentication
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  
  // Match settings
  REQUIRED_PLAYERS_PER_MATCH: 10, // 5v5 matches by default
  MMR_GAIN_PER_WIN: 25,
  MMR_LOSS_PER_LOSS: 20,
  
  // Streak settings
  STREAK_THRESHOLD: 3, // Number of consecutive wins before streak bonus applies
  STREAK_BONUS_PER_WIN: 5, // Extra MMR per win above threshold
  MAX_STREAK_BONUS: 50, // Cap on streak bonus
  
  // Default MMR
  DEFAULT_MMR: 1000,
  
  // Queue settings
  QUEUE_TIMEOUT_MINUTES: 30, // Remove players from queue after 30 minutes
  MAX_QUEUE_SIZE: 100,
  
  // Vote settings
  VOTE_TIMEOUT_SECONDS: 60, // Time limit for votes
  VOTE_KICK_THRESHOLD: 0.5, // Percentage of team required to kick (0.5 = majority)
  
  // Cooldown settings
  COMMAND_COOLDOWN_SECONDS: 5, // Cooldown between commands
  
  // Discord channel IDs
  // These would be set in a real implementation but are empty in this example
  LOG_CHANNEL_ID: '',
  MATCH_RESULTS_CHANNEL_ID: '',
  ADMIN_CHANNEL_ID: '',
  
  // Logging
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
};
