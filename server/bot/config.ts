// Configuration for the Discord bot with default values
// Note: Many of these values are now managed via the configuration file (discordbot-config.json)
// and the settings in shared/botConfig.ts

import fs from 'fs';
import path from 'path';
import { defaultBotConfig } from '@shared/botConfig';

// Path to the configuration file (same as in storage.ts)
const CONFIG_FILE_PATH = path.join(process.cwd(), 'discordbot-config.json');

// Try to read configuration from file if it exists
let fileConfig = defaultBotConfig;
try {
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    fileConfig = JSON.parse(fileContent);
  }
} catch (error) {
  console.error('[CONFIG] Error loading config in bot/config.ts:', error);
}

export const config = {
  // Bot authentication (still using environment variables)
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  
  // Discord server settings
  guildId: fileConfig.general.guildId || '', // Added for command registration
  
  // Match settings (these should be moved to the JSON config eventually)
  REQUIRED_PLAYERS_PER_MATCH: fileConfig.matchmaking.queueSizeLimits.min,
  MMR_GAIN_PER_WIN: 25, // Should be calculated from k-factor
  MMR_LOSS_PER_LOSS: 20, // Should be calculated from k-factor
  
  // Streak settings (these should be moved to JSON config)
  STREAK_THRESHOLD: 3,
  STREAK_BONUS_PER_WIN: 5,
  MAX_STREAK_BONUS: 50,
  
  // Default MMR (from JSON config)
  DEFAULT_MMR: fileConfig.mmrSystem.startingMmr,
  
  // Queue settings (from JSON config)
  QUEUE_TIMEOUT_MINUTES: fileConfig.matchmaking.queueTimeoutMinutes,
  MAX_QUEUE_SIZE: fileConfig.matchmaking.queueSizeLimits.max,
  
  // Vote settings (from JSON config)
  VOTE_TIMEOUT_SECONDS: 60, // Not in JSON config yet
  VOTE_KICK_THRESHOLD: fileConfig.matchRules.voteSystemSettings.majorityPercent / 100,
  
  // Cooldown settings
  COMMAND_COOLDOWN_SECONDS: 5, // Not in JSON config yet
  
  // Discord channel IDs (from JSON config if available)
  LOG_CHANNEL_ID: fileConfig.general.errorNotificationChannelId || '',
  MATCH_RESULTS_CHANNEL_ID: fileConfig.notifications.announcementChannelId || '',
  ADMIN_CHANNEL_ID: '',
  
  // Logging
  LOG_LEVEL: fileConfig.general.loggingLevel || 'info'
};
