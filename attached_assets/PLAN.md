
# Discord Matchmaking Bot - Technical Documentation

## Executive Summary

This Discord bot provides an automated matchmaking and queue management system for competitive gaming communities. The core functionality allows players to join a queue, get matched into balanced teams based on their MMR (Matchmaking Rating), play matches, and have their performance tracked over time. The system also includes features such as vote-based match result reporting, player kick voting, seasonal rankings, and player profiles with statistics.

The primary value proposition of this application is to automate the previously manual process of creating balanced teams, managing competitive matches, and tracking player performance in Discord gaming communities. By providing a robust ranking system, match history, and organized match channels, the bot enhances the competitive experience while eliminating the administrative overhead typically required to manage such systems. The integration of voting mechanisms for match outcomes and player management creates a self-moderating community experience.

## System Architecture

### 1. Core Systems

#### 1.1 Database Layer
- **Purpose**: Persistent storage of all data related to players, matches, queues, and seasons
- **Data Models**:
  - Player: Stores user profiles, MMR, win/loss stats
  - Match: Records of matches, teams, and results
  - Team: Groups of players for each match
  - Queue: Players waiting for matches
  - Season: Time periods for ranking resets and competitions
- **Relationships**:
  - One-to-many relationships between players and matches
  - One-to-many relationships between seasons and matches
  - Join tables for team membership

#### 1.2 Discord Integration Layer
- **Purpose**: Interface with Discord API for bot functionality
- **Key Components**:
  - Discord.js client (`Client`)
  - Event handlers for message and interaction events
  - Command registration system
- **Authentication**: 
  - Uses Discord bot token stored in environment variables
- **API Usage**:
  - Channel management (creation, permissions, deletion)
  - Message handling and reactions
  - User interaction via buttons, select menus, and modals
  - Slash command registration and handling

#### 1.3 Configuration System
- **Purpose**: Centralized management of system settings
- **Key Components**:
  - `config.ts` file containing all configurable parameters
- **Key Settings**:
  - MMR calculations and adjustments
  - Queue requirements
  - Discord API intents and permissions
  - Timeouts and durations
  - Debug flags

### 2. Feature Modules

#### 2.1 Queue Management
- **Purpose**: Handle player queue for matchmaking
- **Key Components**:
  - `QueueService` class
- **Functionality**:
  - Add/remove players to queue
  - Support for dummy players for testing
  - Check and create matches when enough players are available
  - Handle waitlisting when queue is full
  - Reset queue functionality

#### 2.2 Match Management
- **Purpose**: Create, manage, and complete matches
- **Key Components**:
  - `MatchService` class (singleton)
- **Functionality**:
  - Team balancing based on MMR
  - Match channel creation and cleanup
  - Ready check system
  - Winner voting system
  - Vote kick system
  - Match timing and automatic progression
  - MMR adjustments after match completion

#### 2.3 Player Profiles
- **Purpose**: Track player statistics and identity
- **Key Components**:
  - `PlayerProfileService` class
- **Functionality**:
  - Gamertag management
  - Stats tracking (wins, losses, streaks)
  - MMR calculation and adjustment
  - Profile display with embeds

#### 2.4 Match History
- **Purpose**: Record and display match results
- **Key Components**:
  - `MatchHistoryService` class
- **Functionality**:
  - Pagination of match history
  - Filtering by player or season
  - Formatted display of match results

#### 2.5 Season Management
- **Purpose**: Organize matches into time periods
- **Key Components**:
  - `SeasonService` class
- **Functionality**:
  - Create new seasons
  - End current seasons
  - Associate matches with seasons
  - View season information

### 3. Command System

#### 3.1 Slash Commands
- **Purpose**: Provide user interface through Discord commands
- **Key Components**:
  - `registerCommands.ts` for registration with Discord API
  - Command handlers in `index.ts`
- **Available Commands**:
  - `/queue` (alias: `/q`): Join the matchmaking queue
  - `/remove` (alias: `/r`): Leave the queue
  - `/list` (alias: `/l`): View current queue and matches
  - `/history`: View match history
  - `/profile` (aliases: `/stats`, `/p`): View player statistics
  - `/streak`: View winning/losing streak information
  - `/votekick`: Initiate a vote to kick a player
  - `/help`: Display available commands
  - Admin commands:
    - `/dummy`: Add dummy players for testing
    - `/resetqueue`: Reset the queue and match channels
    - `/season`: Season management commands
    - `/matchtimer`: Adjust match timer duration
    - `/resetdata`: Reset all data (dangerous)
    - `/togglevoice`: Toggle voice channel creation

#### 3.2 Message Commands
- **Purpose**: Alternative interface through text commands
- **Key Components**:
  - Message event handler in `index.ts`
- **Functionality**:
  - Vote processing for active vote kicks
  - Special handling for voting messages
  - Admin override commands for matches

#### 3.3 Button Interactions
- **Purpose**: Interactive UI elements
- **Key Components**:
  - Interaction handlers in `index.ts`
- **Functionality**:
  - Queue joining/leaving buttons
  - Ready check button
  - Team voting buttons
  - Match history navigation

### 4. Utility Functions and Helpers

#### 4.1 Error Handling
- **Purpose**: Standardized error management
- **Key Components**:
  - Custom error classes in `/errors` directory
- **Error Types**:
  - `CommandError`: General command execution errors
  - `DatabaseError`: Issues with database operations
  - `InvalidPageError`: Pagination errors
  - `MatchHistoryErrors`: Match history retrieval issues
  - `PlayerProfileError`: Profile-related errors
  - `QueueError`: Queue operation errors
  - `SeasonError`: Season management errors
  - `VoteKickError`: Vote kick process errors

#### 4.2 Logging System
- **Purpose**: Debug information and monitoring
- **Key Components**:
  - Console logging throughout the codebase
- **Features**:
  - Detailed vote process logging
  - Error tracking
  - Match state changes
  - Command processing

## Installation Instructions

### System Requirements
- Node.js (v16.x or higher)
- npm (v7.x or higher)
- Discord bot account with proper permissions
- Replit account (for hosting)

### Setup Process

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd discord-matchmaking-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   - Go to the "Secrets" tab (lock icon) in Replit
   - Add the following secrets:
     - `DISCORD_TOKEN`: Your Discord bot token
     - `CLIENT_ID`: Your Discord application client ID

4. **Initialize the Database**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Register Slash Commands**
   The bot automatically registers commands on startup, but you can manually trigger it with:
   ```bash
   npm run register
   ```

6. **Start the Bot**
   ```bash
   npm start
   ```

### Configuration Options

1. **Edit `src/config.ts`** to customize:
   - Starting MMR (`startingMMR`)
   - Required players per match (`requiredPlayers`)
   - MMR gain/loss values (`baseMMRGain`, `baseMMRLoss`)
   - Preliminary game settings (`preliminaryGames`, `preliminaryMMRGain`)
   - Streak bonuses (`streakThreshold`, `streakMMRBonus`, `streakMMRScale`)
   - Vote timeouts (`voteTimeout`)

2. **Bot Permissions**
   The bot requires the following permissions:
   - Manage Channels
   - Manage Roles
   - Read/Send Messages
   - Create Public/Private Threads
   - Manage Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Add Reactions
   - Use Slash Commands

### Troubleshooting Common Issues

1. **Missing Bot Token**
   - Error: `DISCORD_TOKEN environment variable is required`
   - Solution: Add the bot token to Replit Secrets

2. **Command Registration Failure**
   - Error: `Failed to register slash commands`
   - Solution: Ensure the bot has `applications.commands` scope and proper permissions

3. **Database Connection Issues**
   - Error: `PrismaClientInitializationError`
   - Solution: Check if the database file exists and has proper permissions

4. **Discord API Rate Limits**
   - Error: `DiscordAPIError: You are being rate limited`
   - Solution: Implement request throttling or wait for rate limit to reset

5. **Vote Processing Errors**
   - Error: `VoteKickError` or vote not being registered
   - Solution: Check console logs for detailed error information about the vote process

## API Documentation

### Discord API Integration

#### Authentication
- Uses bot token for authentication with Discord API
- Requires appropriate OAuth2 scopes:
  - `bot`
  - `applications.commands`
  - `messages.read`

#### Slash Command API
- Commands registered via `registerCommands.ts`
- Uses Discord's application command API (v10)
- Command structures defined using `SlashCommandBuilder`

### Database API (Prisma)

#### Models and Relationships
```
Player (1) --- (*) Queue
Player (1) --- (*) Match
Player (*) --- (*) Team
Match (1) --- (*) Team
Match (1) --- (1) Season
```

#### Key Queries
- Player lookup by Discord ID
- Match history retrieval with pagination
- Queue status checks
- Team balancing based on MMR

#### Transactions
Used for operations requiring multiple related database changes:
- Match creation (players, teams, queue updates)
- Match completion (MMR updates, stats recording)
- Season transitions

### Internal Service APIs

#### QueueService
- `addToQueue(playerId: string): Promise<boolean>`
- `removeFromQueue(playerId: string): Promise<boolean>`
- `checkAndCreateMatch(guild: Guild, force: boolean): Promise<boolean>`
- `getQueueStatus(): Promise<{ queue: Queue[], waitlist: Queue[], matches: Match[] }>`

#### MatchService
- `createMatch(players: string[], guild: Guild): Promise<Match | null>`
- `markPlayerReady(playerId: string, channelId: string): Promise<ReadyResult>`
- `processWinnerVote(channelId: string, playerId: string, team: number): Promise<VoteResult>`
- `initiateVoteKick(targetId: string, channelId: string, guild: Guild): Promise<boolean>`

#### PlayerProfileService
- `setGamertag(userId: string, gamertag: string): Promise<Player | null>`
- `createProfileEmbed(user: User): Promise<EmbedBuilder | null>`
- `getStreakInfo(userId: string): Promise<EmbedBuilder | null>`

#### MatchHistoryService
- `getMatchHistory(playerId?: string, page?: number, seasonId?: string): Promise<{ embed: EmbedBuilder, totalPages: number }>`

#### SeasonService
- `createSeason(number: number, name?: string): Promise<Season>`
- `endCurrentSeason(): Promise<Season | null>`
- `getCurrentSeason(): Promise<Season & { _count: { matches: number } } | null>`

### Error Handling Patterns
- Custom error classes for specific error types
- Try-catch blocks around critical operations
- Detailed error messages with appropriate HTTP status codes
- Graceful degradation for non-critical failures

## Development Workflow

### Code Organization
- `/src`: Main source code
  - `/errors`: Custom error classes
  - `/services`: Core business logic services
  - `config.ts`: Configuration settings
  - `index.ts`: Main entry point and event handlers
  - `registerCommands.ts`: Slash command registration
- `/prisma`: Database schema and migrations

### Development Process
1. **Local Development**
   - Make changes to TypeScript files in `/src`
   - Run `npm run build` to compile to JavaScript
   - Run `npm start` to test changes

2. **Testing**
   - Manual testing in a Discord server
   - Use `/dummy` command to simulate players
   - Check console logs for errors and debug information

3. **Database Changes**
   - Edit `prisma/schema.prisma`
   - Run `npx prisma migrate dev --name <migration-name>`
   - Update service classes to use new schema

### Best Practices
- Use TypeScript interfaces for type safety
- Follow singleton pattern for services that need global state
- Use Discord.js v14 interaction patterns
- Implement proper error handling and logging
- Use consistent formatting and naming conventions

## Deployment Process

### Replit Deployment
1. **Initial Setup**
   - Fork the repository to your Replit account
   - Add necessary secrets (DISCORD_TOKEN, CLIENT_ID)
   
2. **Continuous Deployment**
   - Replit automatically deploys changes when pushed to the repository
   - Ensure the `.replit` file has the correct run command
   
3. **Monitoring**
   - Use Replit's console to view logs and errors
   - Set up UptimeRobot or similar service to ping the app and keep it alive

### Production Considerations
- Implement proper error handling and recovery
- Consider database backups for important data
- Monitor Discord API rate limits
- Implement graceful shutdown for maintenance

## Maintenance Procedures

### Regular Maintenance
1. **Database Optimization**
   - Periodically clean up old match data if needed
   - Run `npx prisma migrate reset` if database issues occur

2. **Discord API Updates**
   - Keep Discord.js library updated
   - Test bot after major Discord API changes

3. **Season Management**
   - End seasons regularly using `/season end`
   - Start new seasons with `/season create`

### Backup Procedures
1. **Database Backup**
   - Regularly export the SQLite database file
   - Consider implementing automated backups

2. **Configuration Backup**
   - Keep backups of the `config.ts` file
   - Document any custom settings

### Recovery Procedures
1. **Bot Token Regeneration**
   - If token is compromised, regenerate in Discord Developer Portal
   - Update the `DISCORD_TOKEN` secret in Replit

2. **Database Recovery**
   - Import backup database file
   - Restart the application

## Performance Considerations

### Scaling Limitations
- SQLite database may become a bottleneck with large user bases
- Discord API rate limits may affect responsiveness
- Single-server architecture limits horizontal scaling

### Optimization Strategies
1. **Database Indexing**
   - Key fields are indexed for faster queries
   - Consider adding indexes for frequently queried fields

2. **Caching**
   - Implement caching for frequently accessed data
   - Limit unnecessary database queries

3. **Resource Management**
   - Clean up unused channels and resources
   - Implement timeouts for inactive matches
   - Limit the number of concurrent matches based on available resources

### Monitoring
- Use console logging to track performance issues
- Consider implementing metrics collection for:
  - Command response times
  - Database query performance
  - API rate limit usage

## Future Enhancements

### Potential Improvements
1. **Advanced MMR System**
   - Implement more sophisticated rating algorithms (Elo, Glicko-2, etc.)
   - Add confidence intervals for preliminary games

2. **Enhanced UI**
   - Add rich embeds for match announcements
   - Implement leaderboards for top players
   - Create detailed match summary screens

3. **Integration Possibilities**
   - Game API integrations for automatic result verification
   - Web dashboard for stats and configuration
   - Tournament management features

4. **Technical Enhancements**
   - Migrate to a more robust database for larger communities
   - Implement comprehensive testing suite
   - Add more granular permission system

### Known Limitations
1. **Scalability**
   - Current design works best for small to medium-sized communities
   - May hit Discord API rate limits with high activity

2. **Resilience**
   - Depends on Discord API availability
   - No automatic recovery from certain error states

3. **Complexity**
   - Learning curve for command usage
   - Administrative overhead for season management
