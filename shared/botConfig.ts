import { z } from 'zod';
import { RankTier } from "./rankSystem";

// General Bot Settings
export const generalConfigSchema = z.object({
  botStatus: z.object({
    activity: z.enum(['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING']).default('PLAYING'),
    statusMessage: z.string().max(128).default('Matchmaking'),
  }),
  commandPrefix: z.string().max(5).default('!'),
  adminRoleIds: z.array(z.string()).default([]),
  loggingLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  errorNotificationChannelId: z.string().optional(),
  logEventChannelId: z.string().optional(), // Channel ID for logging important events
  guildId: z.string().optional(), // Guild ID for command registration
});

// Matchmaking Settings
export const matchmakingConfigSchema = z.object({
  queueSizeLimits: z.object({
    min: z.number().int().min(2).max(50).default(2),
    max: z.number().int().min(2).max(50).default(10),
  }),
  autoMatchCreation: z.boolean().default(true),
  matchCreationIntervalSeconds: z.number().int().min(5).max(300).default(30),
  queueTimeoutMinutes: z.number().int().min(1).max(240).default(60),
  minPlayersPerTeam: z.number().int().min(1).max(10).default(5),
  teamBalanceMethod: z.enum(['random', 'mmr', 'role']).default('mmr'),
  matchAnnouncementFormat: z.string().max(1000).default('Match #{matchId} has been created! Teams: Team {team1} vs Team {team2}'),
  postMatchResultsFormat: z.string().max(1000).default('Match #{matchId} has ended! Winner: {winnerTeam}'),
  autoEndMatchHours: z.number().min(1).max(48).default(24),
});

// MMR System Configuration
export const mmrConfigSchema = z.object({
  startingMmr: z.number().int().min(0).max(5000).default(1000),
  kFactor: z.number().min(1).max(64).default(32),
  mmrCalculationMethod: z.enum(['elo', 'glicko2', 'custom']).default('elo'),
  placementMatches: z.number().int().min(0).max(20).default(5),
  mmrRangeRestrictions: z.boolean().default(true),
  maxMmrDifference: z.number().int().min(0).max(2000).default(300),
  streakSettings: z.object({
    threshold: z.number().int().min(1).max(20).default(3),
    bonusPerWin: z.number().int().min(1).max(50).default(5),
    maxBonus: z.number().int().min(5).max(200).default(25),
  }).default({
    threshold: 3,
    bonusPerWin: 5,
    maxBonus: 25,
  }),
});

import { rankTierSchema, defaultRankTiers } from "./rankSystem";

// Season Management
export const seasonConfigSchema = z.object({
  currentSeason: z.number().int().min(1).default(1),
  seasonStartDate: z.string().optional(),
  seasonEndDate: z.string().optional(),
  mmrResetType: z.enum(['full', 'soft', 'none']).default('soft'),
  placementMatchRequirements: z.number().int().min(0).max(20).default(10),
  rewardTiers: z.array(z.object({
    name: z.string(),
    mmrThreshold: z.number().int(),
    description: z.string(),
  })).default([]),
  rankTiers: z.array(rankTierSchema).default(defaultRankTiers),
  enableEndOfSeasonAnnouncements: z.boolean().default(true),
});

// Match Rules
export const matchRulesConfigSchema = z.object({
  voteSystemSettings: z.object({
    majorityPercent: z.number().min(50).max(100).default(75),
    minVotesNeeded: z.number().int().min(1).default(3),
  }),
  matchTimeLimitHours: z.number().min(0.5).max(48).default(2),
  enableForfeit: z.boolean().default(true),
  noShowTimeoutMinutes: z.number().int().min(1).max(30).default(10),
  minPlayersToStart: z.number().int().min(1).default(4),
  allowSubstitutes: z.boolean().default(true),
});

// Notification Settings
export const notificationConfigSchema = z.object({
  matchReminders: z.boolean().default(true),
  reminderMinutesBefore: z.number().int().min(1).max(60).default(5),
  dmNotifications: z.object({
    matchCreated: z.boolean().default(true),
    matchReminder: z.boolean().default(true),
    matchEnded: z.boolean().default(true),
    queueTimeout: z.boolean().default(true),
  }),
  channelNotifications: z.object({
    matchCreated: z.boolean().default(true),
    matchEnded: z.boolean().default(true),
    queueStatus: z.boolean().default(true),
  }),
  enableRoleMentions: z.boolean().default(true),
  announcementChannelId: z.string().optional(),
});

// Integration Settings
export const integrationConfigSchema = z.object({
  discordServerUrl: z.string().url().optional(),
  apiKeys: z.record(z.string()).default({}),
  webhookUrls: z.record(z.string().url()).default({}),
  enableOAuth2: z.boolean().default(false),
  oauth2Settings: z.record(z.string()).default({}),
  externalPlatformIntegrations: z.array(z.enum(['steam', 'faceit', 'battlenet', 'epic'])).default([]),
});

// Data Management
export const dataManagementConfigSchema = z.object({
  enableDataExports: z.boolean().default(true),
  dataRetentionDays: z.number().int().min(30).max(3650).default(365),
  backupSchedule: z.enum(['daily', 'weekly', 'monthly', 'never']).default('weekly'),
  enableDataImport: z.boolean().default(false),
});

// Combined bot configuration
export const botConfigSchema = z.object({
  general: generalConfigSchema,
  matchmaking: matchmakingConfigSchema,
  mmrSystem: mmrConfigSchema,
  seasonManagement: seasonConfigSchema,
  matchRules: matchRulesConfigSchema,
  notifications: notificationConfigSchema,
  integrations: integrationConfigSchema,
  dataManagement: dataManagementConfigSchema,
  rankTiers: z.array(rankTierSchema).default(defaultRankTiers), //Added rankTiers here.

});

// Types
export type GeneralConfig = z.infer<typeof generalConfigSchema>;
export type MatchmakingConfig = z.infer<typeof matchmakingConfigSchema>;
export type MmrConfig = z.infer<typeof mmrConfigSchema>;
export type SeasonConfig = z.infer<typeof seasonConfigSchema>;
export type MatchRulesConfig = z.infer<typeof matchRulesConfigSchema>;
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
export type IntegrationConfig = z.infer<typeof integrationConfigSchema>;
export type DataManagementConfig = z.infer<typeof dataManagementConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;

// Default configuration
export const defaultBotConfig: BotConfig = {
  general: {
    botStatus: {
      activity: 'PLAYING',
      statusMessage: 'Matchmaking',
    },
    commandPrefix: '!',
    adminRoleIds: [],
    loggingLevel: 'info',
    errorNotificationChannelId: undefined,
    logEventChannelId: undefined, // Added for event logging
    guildId: undefined, // Added for command registration
  },
  matchmaking: {
    queueSizeLimits: {
      min: 2,
      max: 10,
    },
    autoMatchCreation: true,
    matchCreationIntervalSeconds: 30,
    queueTimeoutMinutes: 60,
    minPlayersPerTeam: 5,
    teamBalanceMethod: 'mmr',
    matchAnnouncementFormat: 'Match #{matchId} has been created! Teams: Team {team1} vs Team {team2}',
    postMatchResultsFormat: 'Match #{matchId} has ended! Winner: {winnerTeam}',
    autoEndMatchHours: 24,
  },
  mmrSystem: {
    startingMmr: 1000,
    kFactor: 32,
    mmrCalculationMethod: 'elo',
    placementMatches: 5,
    mmrRangeRestrictions: true,
    maxMmrDifference: 300,
    streakSettings: {
      threshold: 3,
      bonusPerWin: 5,
      maxBonus: 25
    },
  },
  seasonManagement: {
    currentSeason: 1,
    seasonStartDate: undefined,
    seasonEndDate: undefined,
    mmrResetType: 'soft',
    placementMatchRequirements: 10,
    rewardTiers: [],
    rankTiers: defaultRankTiers,
    enableEndOfSeasonAnnouncements: true,
  },
  matchRules: {
    voteSystemSettings: {
      majorityPercent: 75,
      minVotesNeeded: 3,
    },
    matchTimeLimitHours: 2,
    enableForfeit: true,
    noShowTimeoutMinutes: 10,
    minPlayersToStart: 4,
    allowSubstitutes: true,
  },
  notifications: {
    matchReminders: true,
    reminderMinutesBefore: 5,
    dmNotifications: {
      matchCreated: true,
      matchReminder: true,
      matchEnded: true,
      queueTimeout: true,
    },
    channelNotifications: {
      matchCreated: true,
      matchEnded: true,
      queueStatus: true,
    },
    enableRoleMentions: true,
    announcementChannelId: undefined,
  },
  integrations: {
    discordServerUrl: undefined,
    apiKeys: {},
    webhookUrls: {},
    enableOAuth2: false,
    oauth2Settings: {},
    externalPlatformIntegrations: [],
  },
  dataManagement: {
    enableDataExports: true,
    dataRetentionDays: 365,
    backupSchedule: 'weekly',
    enableDataImport: false,
  },
  rankTiers: defaultRankTiers,
};