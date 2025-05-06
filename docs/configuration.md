# Configuration Guide

## Overview

MatchMaker provides extensive configuration options to customize the bot's behavior for your specific gaming community. This guide explains the available configuration options and how to modify them.

## Configuration File

The bot uses a configuration file `discordbot-config.json` located in the root directory. If this file doesn't exist, the system will create one with default settings.

## Configuration Sections

### General Settings

```json
"general": {
  "botStatus": {
    "activity": "PLAYING",
    "statusMessage": "Matchmaking"
  },
  "commandPrefix": "!",
  "adminRoleIds": [],
  "loggingLevel": "info",
  "errorNotificationChannelId": null,
  "logEventChannelId": null,
  "guildId": null
}
```

| Option | Description |
|--------|-------------|
| `botStatus.activity` | The bot's activity type - PLAYING, WATCHING, LISTENING, or COMPETING |
| `botStatus.statusMessage` | Status message displayed under the bot's name |
| `commandPrefix` | Legacy command prefix (slash commands are used by default) |
| `adminRoleIds` | Array of Discord role IDs that have admin privileges |
| `loggingLevel` | Logging detail level - debug, info, warn, or error |
| `errorNotificationChannelId` | Channel to send error notifications |
| `logEventChannelId` | Channel to log important events |
| `guildId` | Discord server ID for command registration |

### Matchmaking Settings

```json
"matchmaking": {
  "queueSizeLimits": {
    "min": 2,
    "max": 10
  },
  "autoMatchCreation": true,
  "matchCreationIntervalSeconds": 30,
  "queueTimeoutMinutes": 60,
  "minPlayersPerTeam": 5,
  "teamBalanceMethod": "mmr",
  "matchAnnouncementFormat": "Match #{matchId} has been created! Teams: Team {team1} vs Team {team2}",
  "postMatchResultsFormat": "Match #{matchId} has ended! Winner: {winnerTeam}",
  "autoEndMatchHours": 24
}
```

| Option | Description |
|--------|-------------|
| `queueSizeLimits.min` | Minimum number of players required for a match |
| `queueSizeLimits.max` | Maximum number of players allowed in a match |
| `autoMatchCreation` | Whether matches are created automatically when enough players are in queue |
| `matchCreationIntervalSeconds` | Interval for checking if a match can be created |
| `queueTimeoutMinutes` | Time before a player is automatically removed from queue |
| `minPlayersPerTeam` | Minimum number of players per team |
| `teamBalanceMethod` | Method for balancing teams - random, mmr, or role |
| `matchAnnouncementFormat` | Format for match creation announcements |
| `postMatchResultsFormat` | Format for match results announcements |
| `autoEndMatchHours` | Hours after which an inactive match is automatically ended |

### MMR System

```json
"mmrSystem": {
  "startingMmr": 1000,
  "kFactor": 32,
  "mmrCalculationMethod": "elo",
  "placementMatches": 5,
  "mmrRangeRestrictions": true,
  "maxMmrDifference": 300,
  "streakSettings": {
    "threshold": 3,
    "bonusPerWin": 5,
    "maxBonus": 25,
    "lossThreshold": 3,
    "penaltyPerLoss": 10,
    "maxLossPenalty": 20
  }
}
```

| Option | Description |
|--------|-------------|
| `startingMmr` | Initial MMR for new players |
| `kFactor` | The K-factor for ELO calculations |
| `mmrCalculationMethod` | Method for calculating MMR - elo, glicko2, or custom |
| `placementMatches` | Number of matches before a player receives their initial rank |
| `mmrRangeRestrictions` | Whether to restrict matchmaking based on MMR range |
| `maxMmrDifference` | Maximum allowed MMR difference between players |
| `streakSettings` | Configuration for streak bonuses/penalties |

### Season Management

```json
"seasonManagement": {
  "currentSeason": 1,
  "seasonStartDate": null,
  "seasonEndDate": null,
  "mmrResetType": "soft",
  "placementMatchRequirements": 10,
  "rewardTiers": [],
  "rankTiers": [...],
  "enableEndOfSeasonAnnouncements": true
}
```

| Option | Description |
|--------|-------------|
| `currentSeason` | The current season number |
| `seasonStartDate` | Start date of the current season (ISO format) |
| `seasonEndDate` | End date of the current season (ISO format) |
| `mmrResetType` | How MMR is reset between seasons - full, soft, or none |
| `placementMatchRequirements` | Number of matches required for placement |
| `rewardTiers` | Configuration for season rewards |
| `rankTiers` | Configuration for rank tiers |
| `enableEndOfSeasonAnnouncements` | Whether to announce season end |

### Match Rules

```json
"matchRules": {
  "voteSystemSettings": {
    "majorityPercent": 75,
    "minVotesNeeded": 5
  },
  "matchTimeLimitHours": 2,
  "enableForfeit": true,
  "noShowTimeoutMinutes": 10,
  "minPlayersToStart": 4,
  "allowSubstitutes": true
}
```

| Option | Description |
|--------|-------------|
| `voteSystemSettings.majorityPercent` | Percentage of votes needed for majority |
| `voteSystemSettings.minVotesNeeded` | Minimum votes required regardless of percentage |
| `matchTimeLimitHours` | Time limit for a match in hours |
| `enableForfeit` | Whether forfeit is enabled |
| `noShowTimeoutMinutes` | Time before a no-show player is penalized |
| `minPlayersToStart` | Minimum players required to start a match |
| `allowSubstitutes` | Whether substitutes are allowed |

### Notifications

```json
"notifications": {
  "matchReminders": true,
  "reminderMinutesBefore": 5,
  "dmNotifications": {
    "matchCreated": true,
    "matchReminder": true,
    "matchEnded": true,
    "queueTimeout": true
  },
  "channelNotifications": {
    "matchCreated": true,
    "matchEnded": true,
    "queueStatus": true
  },
  "enableRoleMentions": true,
  "announcementChannelId": null
}
```

| Option | Description |
|--------|-------------|
| `matchReminders` | Whether to send match reminders |
| `reminderMinutesBefore` | Minutes before match to send reminder |
| `dmNotifications` | Configuration for direct message notifications |
| `channelNotifications` | Configuration for channel notifications |
| `enableRoleMentions` | Whether to mention roles in announcements |
| `announcementChannelId` | Channel ID for announcements |

### Integrations

```json
"integrations": {
  "discordServerUrl": null,
  "apiKeys": {},
  "webhookUrls": {},
  "enableOAuth2": false,
  "oauth2Settings": {},
  "externalPlatformIntegrations": []
}
```

| Option | Description |
|--------|-------------|
| `discordServerUrl` | URL to your Discord server |
| `apiKeys` | API keys for external services |
| `webhookUrls` | Webhook URLs for external integrations |
| `enableOAuth2` | Whether OAuth2 authentication is enabled |
| `oauth2Settings` | OAuth2 configuration |
| `externalPlatformIntegrations` | External platforms to integrate with |

### Data Management

```json
"dataManagement": {
  "enableDataExports": true,
  "dataRetentionDays": 365,
  "backupSchedule": "weekly",
  "enableDataImport": false
}
```

| Option | Description |
|--------|-------------|
| `enableDataExports` | Whether data exports are enabled |
| `dataRetentionDays` | Days to retain data |
| `backupSchedule` | Backup schedule - daily, weekly, monthly, or never |
| `enableDataImport` | Whether data imports are enabled |

## Rank Tiers

The bot includes a configurable rank system with customizable tiers. The default tiers are:

- **Bronze**: 0-999 MMR
- **Silver**: 1000-1499 MMR
- **Gold**: 1500-1999 MMR
- **Platinum**: 2000-2499 MMR
- **Diamond**: 2500+ MMR

You can customize these tiers in the `rankTiers` configuration section, specifying name, MMR threshold, color (hex), and description for each tier.

## Updating Configuration

Configuration can be updated in several ways:

1. Directly edit the `discordbot-config.json` file and restart the bot
2. Use admin commands (if implemented) to update configuration at runtime
3. Use the web interface (if implemented) to update configuration

After updating configuration, some changes may require a bot restart to take effect.