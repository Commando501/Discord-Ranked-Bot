
# Project Patch Log

## Project Overview
Discord Matchmaking Bot with MMR-based team balancing, queue management, and match tracking functionality.

### Core Systems
1. **Discord Integration** (`server/bot/`) - Handles Discord API interactions and bot commands
2. **Database Layer** (`server/storage.ts`) - Manages persistent storage via Drizzle ORM
3. **Matchmaking System** (`server/bot/services/`) - Handles queue and match management
4. **Configuration System** (`shared/botConfig.ts`) - Manages bot settings and configuration

### Critical Components (Do Not Modify Without Review)
- `server/db.ts` - Database connection handling
- `shared/schema.ts` - Database schema definitions
- `shared/botConfig.ts` - Core configuration schema
- `server/storage.ts` - Storage interface implementation

## Recent Changes

### 2024-03-14 03:45:12 UTC
**Type**: Bug Fix
**Files Modified**: 
- `server/index.bot.ts`

**Changes**:
- Fixed Discord ID field name in player registration
- Changed `id` to `discordId` in user data object passed to `ensurePlayerExists`

**Purpose**: Fix "Missing discord ID" error in player registration during command execution

**Dependencies Affected**: None

### 2024-03-14 03:16:34 UTC
**Type**: Bug Fix
**Files Modified**: 
- `server/bot/services/playerService.ts`

**Changes**:
- Added Discord ID validation in `ensurePlayerExists` method
- Added fallback values for username and discriminator
- Enhanced error handling for player creation

**Purpose**: Fix null value violation in players table discord_id column

**Dependencies Affected**: None

## Technical Debt & Improvement Areas

### High Priority
1. Error Handling
   - Need consistent error handling across services
   - Should implement proper error classes

2. Database Operations
   - Transaction support needed for critical operations
   - Connection pooling optimization required

### Medium Priority
1. Code Organization
   - Service layer needs better separation of concerns
   - Command handlers could be modularized further

2. Testing
   - Unit tests missing for core services
   - Integration tests needed for Discord commands

### Low Priority
1. Documentation
   - API documentation incomplete
   - Configuration options need better documentation

## File Structure & Functions

### Server Components
- `server/index.bot.ts`: Main bot initialization and event handling
- `server/storage.ts`: Database operations implementation
- `server/bot/services/`: Core service implementations
  - `playerService.ts`: Player management
  - `queueService.ts`: Queue operations
  - `matchService.ts`: Match handling

### Shared Components
- `shared/botConfig.ts`: Configuration schemas and validation
- `shared/schema.ts`: Database schema definitions

### Client Components
- React-based web interface for administration
- Components for configuration and monitoring

## Known Issues
1. Race conditions possible in queue management
2. Memory usage optimization needed for large servers
3. Error handling inconsistencies in Discord interactions

## Planned Features
1. Advanced MMR calculation system
2. Season management improvements
3. Tournament mode support
4. Enhanced statistics tracking

---
*Last Updated: 2024-03-14 03:16:34 UTC*
