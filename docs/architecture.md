# Architecture Guide

## System Overview

MatchMaker is built on a layered, service-oriented architecture that promotes separation of concerns, testability, and maintainability. The application uses TypeScript throughout to provide strong typing and better developer experience.

## Architectural Layers

### 1. Interface Layer

The interface layer is responsible for handling user interactions via Discord. This layer includes:

- Discord bot commands and event handlers
- Message formatters and user interaction components
- Feedback providers to users

**Key Components:**
- `server/discord/bot.ts` - Main Discord client setup
- `server/discord/commands/*.ts` - Individual command handlers
- `server/index.bot.ts` - Bot initialization and event handling

### 2. Service Layer

The service layer implements the core business logic of the application. It contains stateful and stateless services that handle specific domains of functionality.

**Key Services:**
- `QueueService` - Manages player queue, matchmaking, and team formation
- `PlayerService` - Handles player data, statistics, and profile management
- `MatchService` - Manages match creation, administration, and results
- `QueueDisplayService` - Manages the display of queue status in Discord

These services follow the singleton pattern where appropriate to ensure consistent state management across the application.

### 3. Data Access Layer

The data layer is responsible for persistence and data retrieval. It abstracts database operations behind a clean interface, making it easier to modify the underlying implementation.

**Key Components:**
- `server/db.ts` - Database connection and transaction management
- `shared/schema.ts` - Database schema definitions using Drizzle ORM
- `server/storage.ts` - Repository pattern implementation providing data access methods

### 4. Configuration Layer

This layer manages application settings and configuration. It provides type-safe access to configuration values and validation.

**Key Components:**
- `.env` - Environment variables for sensitive configuration
- `discordbot-config.json` - Application configuration file
- `shared/botConfig.ts` - Configuration validation using Zod schemas

## Data Flow

### Command Processing Flow

1. A user issues a slash command in Discord
2. Discord.js receives the interaction and routes it to the appropriate command handler
3. The command handler validates the input and calls the appropriate service(s)
4. Services perform the business logic and interact with the data layer
5. The command handler formats the response and sends it back to Discord

### Matchmaking Flow

1. A player uses `/queue` to join the matchmaking queue
2. The QueueService adds the player to the queue and notifies the QueueDisplayService
3. The QueueService periodically checks for enough players to form a match
4. When sufficient players are available, the MatchService creates teams based on MMR
5. A match is created, channels are set up, and players are notified
6. After match completion, results are recorded and MMR is adjusted

## Database Schema

The application uses the following database tables:

- **players**: User information and statistics
- **queue**: Current matchmaking queue
- **matches**: Match information and status
- **teams**: Team composition for matches
- **team_players**: Mapping of players to teams
- **match_votes**: Votes for match results
- **vote_kicks**: Vote kick initiations
- **vote_kick_votes**: Votes on kick proposals

## Concurrency and Transaction Management

To prevent race conditions and ensure data integrity, the application uses database transactions for critical operations:

```typescript
withTransaction(async (tx) => {
  // Operations that need to be atomic
  await tx.commit();
});
```

This approach ensures that multiple database operations either all succeed or all fail together.

## Extensibility

The architecture is designed to be extensible in several ways:

1. **New Commands**: Additional commands can be added by extending the commands array in `server/bot/commands.ts`
2. **Additional Services**: New services can be created to handle specific domains
3. **Database Extensions**: The schema can be extended to support new features
4. **Web Interface**: The Express server can be extended to provide a web-based admin dashboard

## Deployment Architecture

The application supports various deployment options:

### Development Environment

- Uses Replit for collaborative development
- Supports hot-reloading for rapid iteration
- Uses environment variables for configuration

### Production Deployments

1. **Traditional Hosting**:
   - NodeJS environment
   - PostgreSQL database
   - Environment variables for configuration

2. **Cloud Run (Google Cloud)**:
   - Container-based deployment
   - Serverless PostgreSQL (Neon)
   - Automated deployment script

## Error Handling and Logging

The application uses Winston for structured logging with different log levels. Errors are caught and handled at appropriate levels:

1. **Command Handlers**: Catch and format user-facing errors
2. **Service Layer**: Log business logic errors and propagate appropriate messages
3. **Data Layer**: Handle database errors and provide meaningful feedback

Logs can be directed to console output and optionally to Discord channels for monitoring.

## Future Architectural Considerations

1. **Web Dashboard**: The infrastructure supports adding a web-based admin interface
2. **Additional Game Integrations**: The service layer is abstracted from Discord specifics
3. **Analytics Pipeline**: The data model supports adding analytics capabilities
4. **Multi-server Support**: The data model can scale to support multiple Discord servers