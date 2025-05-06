# Matchmaker Discord Bot

A Discord bot for organizing competitive matches through a matchmaking system.

## Installation

### Prerequisites

- Node.js 16.x or later
- PostgreSQL database
- Discord Bot Token
- Discord Server with admin privileges

### Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click on "New Application" and give your application a name
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the "Token" section, click "Reset Token" to generate a new token (save this for later)
5. Enable the following Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
6. Under "Bot Permissions", ensure the bot has appropriate permissions
7. Go to the "OAuth2" tab, select "URL Generator", and select "bot" and "applications.commands" scopes
8. Copy the generated URL and use it to invite the bot to your server

### Application Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/matchmaker.git
   cd matchmaker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create a `.env` file in the root directory):
   ```
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token

   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/matchmaker
   ```

4. Initialize the database:
   ```bash
   npm run db:push
   ```

5. Start the application:
   ```bash
   # Development mode with hot reloading
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

### Database Management

The application includes tools for managing database backups and restores.

### Configuration
The bot is highly configurable through the `discordbot-config.json` file. You can adjust the following settings:

#### General Settings
```json
"general": {
  "botStatus": {
    "activity": "PLAYING",
    "statusMessage": "Matchmaking"
  },
  "commandPrefix": "!",
  "adminRoleIds": [],
  "loggingLevel": "info"
}
```

#### Matchmaking Settings
```json
"matchmaking": {
  "queueSizeLimits": {
    "min": 2,
    "max": 10
  },
  "autoMatchCreation": true,
  "matchCreationIntervalSeconds": 30,
  "minPlayersPerTeam": 5,
  "teamBalanceMethod": "mmr"
}
```

#### MMR System
```json
"mmrSystem": {
  "startingMmr": 1000,
  "kFactor": 32,
  "mmrCalculationMethod": "elo",
  "placementMatches": 5,
  "streakSettings": {
    "threshold": 3,
    "bonusPerWin": 5,
    "maxBonus": 25
  }
}
```

#### Rank Tiers

The default rank tiers are:

- **Bronze**: 0-999 MMR
- **Silver**: 1000-1499 MMR
- **Gold**: 1500-1999 MMR
- **Platinum**: 2000-2499 MMR
- **Diamond**: 2500+ MMR

For more comprehensive configuration options, see the `docs/configuration.md` file.

## 💻 Usage
MatchMaker uses Discord's slash commands for all interactions. Start typing `/` in any channel where the bot has permissions to see the available commands.

### Player Commands

| Command | Description | Example |
|---------|-------------|--------|
| `/queue` | Join the matchmaking queue | `/queue` |
| `/leave` | Leave the matchmaking queue | `/leave` |
| `/list` | List all players currently in the queue | `/list` |
| `/profile [user]` | View player statistics | `/profile @username` |
| `/history [user] [count]` | View match history | `/history @username 10` |
| `/streak [user]` | Display current win/loss streak | `/streak` |
| `/votekick [target]` | Vote to kick a player from a match | `/votekick @username` |

### Admin Commands

| Command | Description | Example |
|---------|-------------|--------|
| `/forcematch [players...]` | Force create a match with specified players | `/forcematch @player1 @player2 @player3...` |
| `/endmatch [match_id] [winning_team]` | End a match and record results | `/endmatch 42 Eagle` |
| `/resetqueue` | Reset the queue | `/resetqueue` |

### Match Flow

Here's the typical flow of a match in MatchMaker:

1. **Queue Phase**:
   - Players join the queue using `/queue`
   - The bot displays the current queue status

2. **Match Creation**:
   - When enough players are in queue, a match is created
   - Teams are balanced based on MMR
   - Players are notified and team channels are created

3. **Match Phase**:
   - Players coordinate in their team channels
   - Players can use `/votekick` if needed

4. **Result Reporting**:
   - After the match, players vote for the winning team
   - When enough votes are received, the result is recorded
   - MMR is adjusted for all players

5. **Post-Match**:
   - Match is archived in history
   - Players can view their updated statistics

### Understanding MMR

MatchMaker uses a skill-based rating system (MMR - Matchmaking Rating) to track player performance:

- **Starting MMR**: New players start with 1000 MMR
- **MMR Changes**: Winning increases MMR, losing decreases it
- **Streaks**: Win/loss streaks can amplify MMR changes
- **Rank Tiers**: Players are placed in rank tiers based on their MMR

For more details on usage, see the complete user guide in `docs/user-guide.md`.

## 🏗️ Architecture

The application follows a layered architecture pattern with the following primary layers:

### 1. Interface Layer

The interface layer handles user interactions via Discord, including:

- Discord bot commands and event handlers
- Message formatters and UI components
- User feedback providers

**Key Files:**

- `server/discord/bot.ts` - Main Discord client setup
- `server/discord/commands/*.ts` - Command handlers
- `server/index.bot.ts` - Bot initialization

### 2. Service Layer

The service layer implements the core business logic of the application:

**Key Services:**

- `QueueService` - Manages player queue and matchmaking
- `PlayerService` - Handles player data and statistics
- `MatchService` - Manages match creation and results
- `QueueDisplayService` - Manages queue status display

### 3. Data Access Layer

The data layer handles persistence and data operations:

**Key Components:**

- `server/db.ts` - Database connection and transactions
- `shared/schema.ts` - Database schema definitions
- `server/storage.ts` - Repository pattern implementation

### 4. Configuration Layer

Manages application settings with type-safe access:

- `.env` - Environment variables for sensitive configuration
- `discordbot-config.json` - Application configuration
- `shared/botConfig.ts` - Zod schema validation

### Database Schema

The application uses the following core tables:

- **players**: User information and statistics
- **queue**: Current matchmaking queue
- **matches**: Match information and status
- **teams**: Team composition for matches
- **team_players**: Mapping of players to teams
- **match_votes**: Votes for match results

### Data Flow

1. A user issues a slash command in Discord
2. The command handler validates input and calls appropriate service(s)
3. Services perform business logic and interact with data layer
4. The command handler formats and sends the response

For more details, see the complete architecture documentation in `docs/architecture.md`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.