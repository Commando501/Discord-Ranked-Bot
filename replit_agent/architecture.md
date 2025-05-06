# Architecture Overview

## 1. Overview

This application is a Discord matchmaking bot designed to facilitate competitive matchmaking for gaming communities. It allows users to queue for matches, tracks player rankings through an MMR (Matchmaking Rating) system, and provides various commands for match management, player statistics, and administrative functions.

The system is built using a modern Node.js backend with TypeScript, utilizing Discord.js for bot functionality and PostgreSQL (via Drizzle ORM) for data persistence. The architecture follows a service-oriented design with clear separation of concerns between bot commands, business logic, and data access.

## 2. System Architecture

The application follows a layered architecture pattern with the following primary layers:

1. **Interface Layer** - Discord bot commands and interactions
2. **Service Layer** - Core business logic and functionality
3. **Data Access Layer** - Database interactions and data models
4. **Configuration Layer** - System settings and configuration management

### Core Architecture Decisions

- **TypeScript** is used throughout the codebase to provide strong typing and better developer experience.
- **Discord.js** is used as the primary framework for Discord API interactions.
- **Drizzle ORM** is used for database operations with a PostgreSQL database.
- **Service-oriented design** separates concerns and enables modular development.
- **Singleton pattern** is employed for critical services to ensure consistent state management.
- **Event-driven communication** allows loose coupling between components.

## 3. Key Components

### 3.1 Discord Bot Interface

The bot interface is responsible for handling Discord API interactions, command processing, and user communication. It uses Discord.js to handle events and slash commands.

Key files:
- `server/discord/bot.ts` - Main Discord client setup
- `server/discord/commands/*.ts` - Individual command handlers
- `server/index.bot.ts` - Bot initialization

The bot uses slash commands for all functionality, with commands organized in individual files for maintainability.

### 3.2 Core Services

Services implement the core business logic of the application, following the singleton pattern for stateful services to ensure consistent operation.

Key services:
- `QueueService` - Manages player queue, matchmaking, and team formation
- `PlayerService` - Handles player data and statistics
- `MatchService` - Manages match creation, administration, and results
- `QueueDisplayService` - Manages the display of queue status in Discord

These services are designed to be independent of the Discord interface, allowing for potential future integration with other platforms.

### 3.3 Data Layer

The data layer is built using Drizzle ORM with PostgreSQL as the backend database.

Key components:
- `server/db.ts` - Database connection and transaction management
- `shared/schema.ts` - Database schema definitions using Drizzle
- `server/storage.ts` - Repository pattern implementation providing data access methods

Schema includes tables for:
- Players
- Queue
- Matches
- Teams
- Team Players
- Match Votes
- Vote Kicks

### 3.4 Configuration Management

The application uses a layered approach to configuration:
- Environment variables for sensitive configuration (`.env`)
- JSON file (`discordbot-config.json`) for application configuration
- Zod schemas (`shared/botConfig.ts`) for configuration validation

This approach allows for flexible configuration management while ensuring type safety.

## 4. Data Flow

### 4.1 Command Processing Flow

1. Discord interaction event is received by the bot
2. Command is identified and routed to the appropriate handler
3. Command handler validates input and calls appropriate service(s)
4. Service(s) perform business logic and data operations
5. Response is sent back to the user via Discord

### 4.2 Matchmaking Flow

1. Player uses `/queue` command to join the matchmaking queue
2. QueueService adds player to queue and notifies QueueDisplayService
3. QueueService periodically checks for enough players to form a match
4. When sufficient players are available, MatchService creates teams based on MMR
5. Match is created and players are notified
6. After match completion, results are recorded and MMR is adjusted

### 4.3 Data Persistence Flow

1. Services make requests to storage layer (repository pattern)
2. Storage layer uses Drizzle ORM to execute database operations
3. For complex operations, transactions are used to ensure data integrity
4. Query results are mapped to appropriate types and returned to services

## 5. External Dependencies

### 5.1 Primary Dependencies

- **discord.js** - Discord API integration
- **drizzle-orm** - ORM for database operations
- **@neondatabase/serverless** - Serverless PostgreSQL client
- **winston** - Logging
- **zod** - Schema validation
- **express** - HTTP server for potential web interface

### 5.2 Development Dependencies

- **TypeScript** - Static typing
- **ESBuild** - Build system
- **Vite** - Development server and bundling
- **tsx** - TypeScript execution

## 6. Deployment Strategy

The application is designed to be deployed in multiple environments:

### 6.1 Development Environment

- Uses Replit as indicated by `.replit` configuration
- Supports hot-reloading for development
- Uses environment variables for configuration

### 6.2 Production Deployment

Two primary deployment options are supported:

1. **Traditional Hosting**:
   - NodeJS environment
   - PostgreSQL database
   - Environment variables for configuration

2. **Cloud Run (Google Cloud)**:
   - Container-based deployment
   - Serverless PostgreSQL (Neon)
   - Automated with deployment script (`deploy.sh`)

### 6.3 Database Migration

Database migration tools are provided to support deployment across environments:
- `server/utils/export-db-script.ts` - Exports database to JSON
- `server/utils/import-db-script.ts` - Imports data from JSON export

## 7. Architecture Challenges and Solutions

### 7.1 Concurrency Management

**Challenge**: Ensuring data consistency with concurrent operations (multiple users queuing/leaving).

**Solution**: Transaction-based operations and optimistic locking through Drizzle ORM's transaction API.

### 7.2 State Management

**Challenge**: Maintaining application state across potential bot restarts.

**Solution**: Persistent storage for all critical state data, with a clean separation between ephemeral and persistent data.

### 7.3 Configuration Management

**Challenge**: Supporting flexible configuration while maintaining type safety.

**Solution**: Layered configuration with environment variables, JSON configuration, and Zod schemas for validation.

### 7.4 Scaling

**Challenge**: Supporting growth in users and matches.

**Solution**: 
- Service-oriented architecture for component isolation
- Database indexing for performance
- Event-driven patterns to reduce coupling

## 8. Future Architectural Considerations

1. **Web Dashboard Integration** - Infrastructure supports adding a web-based admin dashboard
2. **Additional Game Integrations** - Service layer is abstracted from Discord specifics
3. **Analytics Pipeline** - Data structure supports adding analytics capabilities
4. **Multi-server Support** - Data model can scale to support multiple Discord servers