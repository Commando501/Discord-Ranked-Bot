# Project Patch Log Index

This file serves as an index to all patch logs, organized by time period.

## Latest Patches

### 2024-06-13 15:45 UTC
**Files Modified**:
- server/discord/commands/leaderboard.ts

**Changes**:
- Fixed the `/leaderboard` command by replacing non-existent `listAllPlayers()` method with available `listTopPlayers(limit)` method
- Set a high limit (1000) to ensure all players are retrieved for accurate leaderboard display
- The command now properly retrieves players ranked by MMR for display in the leaderboard

**Testing**: Verified the command no longer throws "TypeError: storage.listAllPlayers is not a function" and properly displays the leaderboard with pagination.

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