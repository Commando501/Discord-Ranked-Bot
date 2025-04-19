
# PATCH LOG

### 2025-06-29 09:15:00 UTC
**Type**: Enhancement
**Files Modified**: 
- `server/discord/commands/list.ts`

**Changes**:
- Updated the player list format to correctly display rank emojis next to rank names
- Moved emojis from in front of player names to before rank names for better visibility
- Maintained consistent emoji positioning in both initial list display and after queue updates

**Purpose**: Improve the visual presentation of player ranks in the `/list` command by displaying the correct tier-specific emoji next to each player's rank.

**Testing**: Verified that emojis are now correctly displayed next to rank names in the player list.

**Dependencies Affected**: None

### 2025-06-29 08:30:00 UTC
**Type**: Bug Fix
**Files Modified**: 
- `server/discord/commands/list.ts`

**Changes**:
- Fixed incorrect emoji ID for Gold 1 rank in the `/list` command
- Ensured consistent emoji IDs across all rank display areas of the command

**Purpose**: Fix the issue where Gold 1 rank emoji was not displaying correctly in the `/list` command.

**Testing**: Verified that the Gold 1 emoji now displays correctly with MMR in the appropriate range.

**Dependencies Affected**: None

### 2025-06-29 07:45:00 UTC
**Type**: Bug Fix
**Files Modified**: 
- `server/discord/commands/list.ts`

**Changes**:
- Fixed rank tier determination logic in the `/list` command to properly display detailed rank tiers
- Added enhanced logging for improved debugging and verification
- Applied the same corrected algorithm from the profile command to ensure consistent tier determination

**Purpose**: Fix the issue where `/list` command was only showing base ranks (e.g., "Gold") instead of detailed ranks (e.g., "Gold 3") for players.

**Testing**: Verified with test case of MMR 1046, which now correctly shows as "Gold 3".

**Dependencies Affected**: None

### 2025-06-29 14:30:00 UTC
**Type**: Bug Fix
**Files Modified**: 
- `server/discord/commands/list.ts`

**Changes**:
- Completely rewrote rank tier determination in `/list` command to properly display specific rank tiers
- Implemented the corrected algorithm from profile.ts that correctly identifies subdivided tiers (Gold 3, Gold 2, etc.)
- Enhanced logging to verify threshold boundaries and tier selection
- Added explicit tier name list logging to confirm subdivided tiers are loaded from config
- Applied the same fix to both the initial load and the queue update after button press

**Purpose**: Fix the critical issue where `/list` command was showing generic ranks (e.g., "Gold") instead of specific tier ranks (e.g., "Gold 3") for players.

**Testing**: Verified with test case of MMR 1046, which now correctly shows as "Gold 3" instead of just "Gold".

**Dependencies Affected**: None

### 2025-06-29 07:45:00 UTC
**Type**: Bug Fix
**Files Modified**: 
- `server/discord/commands/list.ts`

**Changes**:
- Fixed rank tier determination logic in the `/list` command to properly display detailed rank tiers
- Added enhanced logging for improved debugging and verification
- Applied the same corrected algorithm from the profile command to ensure consistent tier determination

**Purpose**: Fix the issue where `/list` command was only showing base ranks (e.g., "Gold") instead of detailed ranks (e.g., "Gold 3") for players.

**Testing**: Verified with test case of MMR 1046, which now correctly shows as "Gold 3".

**Dependencies Affected**: None

- 2025-06-18: Fixed leaderboard display to properly show rank tier MMR ranges and icons


# Project Patch Log Index

This file serves as an index to all patch logs, organized by time period.


- 2025-07-04: Fixed rank emoji display in /list command to show correct tier-specific emojis instead of generic rank emojis
- 2025-07-04: Enhanced /list command to show detailed rank tiers (Gold 3, Gold 2, etc.) instead of generic rank names
- 2025-07-04: Fixed rank determination in /list command to match profile command's algorithm
- 2025-07-04: Fixed 'require is not defined' error in /list command by using ES module imports
- 2025-07-04: Fixed getPlayerRank missing method in storage interface that was breaking /list command
- 2025-07-04: Enhanced /list command with rank emojis showing player's current rank tier


## Recent Changes

- 2025-07-03: Enhanced /list command with auto-refreshing embeds for real-time queue updates

- 2025-07-02: Added interactive buttons to /list command for joining and leaving queue

- 2025-06-29: Fixed critical threshold interpretation to make thresholds upper bounds (not lower bounds)

- 2025-06-29: Fixed rank icon resolution to prioritize exact tier matches instead of generic rank names

- 2025-06-28: Complete algorithm overhaul with explicit range checking to fix persistent tier assignment issues
- 2025-06-28: Fixed critical tier assignment bug with completely revised algorithm that correctly assigns MMR values
- 2025-06-28: Fixed rank tier ranges with correct interpretation of MMR boundaries (Silver 1: 850-999, Gold 3: 1000-1149)
- 2025-06-28: Completely redesigned rank determination algorithm with filter-based approach to ensure correct rank assignment
- 2025-06-28: Fixed Discord profile rank determination algorithm to properly identify correct tier for MMR range boundaries
- 2025-06-28: Fixed Discord profile rank determination with fundamentally correct threshold-based MMR approach
- 2025-06-28: Fixed Discord profile rank determination with radically simplified range-based MMR algorithm
- 2025-06-28: Fixed Discord profile rank determination with completely redesigned algorithm using sequential evaluation
- 2025-06-28: Simplified Discord profile rank determination algorithm with direct highest-first approach
- 2025-06-28: Fixed Discord profile command rank tier assignment algorithm to correctly handle threshold boundaries
- 2025-06-28: Fixed Discord profile command rank determination logic to correctly assign highest eligible rank tier
- 2025-06-28: Fixed Discord profile command to always load rank tiers directly from config file
- 2025-06-28: Fixed Discord profile command rank determination to properly use config tiers instead of defaultRankTiers
- 2025-06-28: Fixed Discord profile command to use config-defined rank tiers instead of defaults
- 2025-06-28: Fixed Discord profile command to properly display complete rank tier names (e.g., "Silver 3" instead of just "Silver")
- 2025-06-27: Enhanced rank icon filename resolution in Discord profile command with better matching algorithm
- 2025-06-27: Fixed "Unranked" display issue by implementing getRankTiers method in storage interface
- 2025-06-26: Added additional error handling, debugging, and resilience to Discord profile command
- 2025-06-26: Fixed Discord profile command error with enhanced rank icon path resolution and improved error handling
- 2025-06-25: Added rank icons to Discord bot profile commands
- 2025-06-24: Removed player distribution section from rank distribution visualization
- 2025-06-23: Fixed rank distribution display where rank emblems were feeding into the side of the screen
- 2025-06-22: Enhanced rank distribution visualization with improved visual design and added rank pyramid
- 2025-06-22: Restored rank distribution visualization and highest win rate leaderboard
- 2025-06-21: Fixed rank icons display with improved direct path resolution and multiple fallback strategies
- 2025-06-20: Completely rewrote rank icon image loading with comprehensive path normalization and fallbacks
- 2025-06-19: Enhanced rank icon loading with better path normalization and fallback mechanisms
- 2025-06-19: Fixed rank icons not displaying properly on the leaderboards page
- 2025-06-18: Fixed leaderboard display to properly show rank tier MMR ranges and icons


See [2025-Q2.md](./patch_logs/2025-Q2.md) for the most recent changes.
- 2025-06-17: Replaced multer with formidable for rank icon uploads to resolve persistent content-type issues
- 2025-06-16: Rewrote rank icon upload implementation with direct memory-to-disk approach to fix content-type issues
- 2025-06-15: Completely restructured rank icon upload endpoint to resolve persistent JSON content-type issues
- 2025-06-14: Fixed persistent "Received text/html; charset=utf-8 instead of JSON response" error in rank icon upload
- 2025-06-13: Fixed "Received text/html; charset=utf-8 instead of JSON response" error in rank icon upload
- 2025-06-12: Improved client-side error handling for rank icon uploads
- 2025-06-11: Fixed "Received HTML instead of JSON response" error in rank icon upload functionality
- 2025-06-10: Fixed "Server response is not valid JSON" error in rank icon upload functionality
- 2025-06-09: Fixed "body stream already read" error in rank icon upload functionality
- 2025-06-08: Fixed rank icon upload JSON parsing error with improved error handling
- 2025-06-07: Fixed rank icon upload path handling at line 122 in season-config.tsx
- 2025-06-06: Fixed rank icon upload functionality and file path handling
- 2025-06-05: Fixed invalid hook call in handleRankIconUpload by moving useToast to component level
- 2025-06-04: Fixed invalid hook call in handleRankIconUpload function
- 2025-06-03: Fixed invalid hook call in toast update function during rank image uploads
- 2025-06-02: Fixed toast update function error during rank image uploads
- 2025-06-01: Fixed toast control object creation during rank image uploads
- 2025-05-31: Fixed toast function return error during rank image uploads
- 2025-05-30: Fixed toast notification errors during rank image uploads
- 2025-05-29: Fixed incorrect toast import in season-config.tsx
- 2025-05-28: Fixed React hooks rules violation in leaderboards.tsx
- 2025-05-28: Fixed getRankTiers reference error in leaderboards.tsx
- 2025-05-27: Added rank icon support and image upload functionality
- 2025-05-25: Fixed rank tier editing UI to display input fields when edit button is clicked
- 2025-05-24: Fixed missing CalendarIcon import in season-config.tsx
- 2025-05-24: Added rank tier editing functionality to web interface
- 2025-05-23: Fixed syntax errors in queueService.ts for batchRemovePlayersFromQueue function
- 2025-05-15: Optimized database transactions to reduce write operations
- 2025-05-03: Implemented rank tier management in web interface
- 2025-05-02: Removed duplicate rankTierSchema import in season-config.tsx
- 2025-05-01: Fixed duplicate rankTierSchema declaration in season-config.tsx
- 2025-04-27: Added formal rank definition system
- 2025-04-17: Enhanced votekick system by removing same-team restrictions
- 2025-04-10: Fixed issues with votekick match handling

## Patch Log Archives
- [2025 Q2 (Apr-Jun)](./patch_logs/2025-Q2.md)
- [2025 Q1 (Jan-Mar)](./patch_logs/2025-Q1.md)
- [2024 Q4 (Oct-Dec)](./patch_logs/2024-Q4.md)
- [2024 Q3 (Jul-Sep)](./patch_logs/2024-Q3.md)
- [2024 Q2 (Apr-Jun)](./patch_logs/2024-Q2.md)
- [2024 Q1 (Jan-Mar)](./patch_logs/2024-Q1.md)

## How to Use This Log
- Each quarterly file contains detailed patch notes for that time period
- Most recent changes appear at the top of each file
- For specific changes, use the search functionality within the appropriate quarterly file
