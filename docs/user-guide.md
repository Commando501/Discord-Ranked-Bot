# User Guide

This guide explains how to use the MatchMaker Discord bot, including all available commands, matchmaking features, and tips for players and administrators.

## Getting Started

MatchMaker uses Discord's slash commands for all interactions. Start typing `/` in any channel where the bot has permissions to see the available commands.

## Player Commands

### Queue Management

#### `/queue`

Join the matchmaking queue to find a match.

**Usage:**
```
/queue
```

**Description:**
Adds you to the matchmaking queue. If enough players are in the queue, a match may be automatically created. The bot will show your current MMR and the current queue status.

#### `/leave`

Leave the matchmaking queue.

**Usage:**
```
/leave
```

**Description:**
Removes you from the matchmaking queue if you're currently in it.

#### `/list`

Show all players currently in the queue.

**Usage:**
```
/list
```

**Description:**
Displays all players in the queue, along with their MMR and time spent waiting.

### Player Statistics

#### `/profile [user]`

View player statistics.

**Usage:**
```
/profile               # View your own profile
/profile @username     # View another player's profile
```

**Description:**
Displays player statistics including MMR, wins, losses, win rate, and current streak.

#### `/history [user] [count]`

View match history.

**Usage:**
```
/history                # View your last 5 matches
/history @username      # View another player's last 5 matches
/history @username 10   # View another player's last 10 matches
```

**Description:**
Displays detailed information about recent matches, including teams, results, and MMR changes.

#### `/streak [user]`

Check current win/loss streak.

**Usage:**
```
/streak               # View your own streak
/streak @username     # View another player's streak
```

**Description:**
Shows the current win or loss streak and its impact on MMR calculations.

## Match Commands

### During a Match

When a match is created, the bot will:

1. Create a private channel for each team
2. Notify all players in the match
3. Provide instructions for reporting results

#### `/votekick [target]`

Vote to kick a player from a match.

**Usage:**
```
/votekick @username
```

**Description:**
Initiates a vote to kick a player from the current match. Other players can vote by typing "yes" or "no" in the match channel. Requires a majority vote to pass.

## Match Result Reporting

After a match is completed, players can report the result by:

1. Using the vote buttons in the match channel
2. A team wins when it receives enough votes

Once a result is reported, the match is marked as completed, and MMR is adjusted for all players.

## Understanding MMR

MatchMaker uses a skill-based rating system called MMR (Matchmaking Rating) to track player performance:

- **Starting MMR**: New players start with 1000 MMR
- **MMR Changes**: Winning increases MMR, losing decreases it
- **Streaks**: Win and loss streaks can amplify MMR changes
- **Rank Tiers**: Players are placed in rank tiers based on their MMR

### Rank Tiers

The default rank tiers are:

- **Bronze**: 0-999 MMR
- **Silver**: 1000-1499 MMR
- **Gold**: 1500-1999 MMR
- **Platinum**: 2000-2499 MMR
- **Diamond**: 2500+ MMR

## Administrator Commands

The following commands are only available to users with administrator roles:

#### `/forcematch [players...]`

Force create a match with specified players.

**Usage:**
```
/forcematch @player1 @player2 @player3 @player4 @player5 @player6 @player7 @player8 @player9 @player10
```

**Description:**
Creates a match with the specified players, bypassing the queue. You must specify at least 2 players, but ideally 10 players for a full match.

#### `/endmatch [match_id] [winning_team]`

End a match and record results.

**Usage:**
```
/endmatch 42 Eagle     # End match 42 with Team Eagle as the winner
```

**Description:**
Manually ends a match and records the result. This is useful for matches that cannot be resolved through voting.

#### `/resetqueue`

Reset the queue.

**Usage:**
```
/resetqueue
```

**Description:**
Clears the current matchmaking queue. This is useful if the queue is stuck or needs to be reset for any reason.

## Match Flow

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

## Tips for Players

1. **Check Queue Status**: Use `/list` to see who's currently in queue
2. **Track Your Progress**: Use `/profile` to monitor your MMR and performance
3. **Be Active**: Matches that remain inactive for too long may be automatically ended
4. **Vote Promptly**: Vote for match results as soon as the match is completed
5. **Report Issues**: If you encounter problems, contact a server administrator

## Tips for Administrators

1. **Configure the Bot**: Adjust settings in the configuration file to match your community's needs
2. **Monitor Activity**: Keep an eye on match activity and player behavior
3. **Manage Roles**: Set up Discord roles for administrators who can use admin commands
4. **Handle Disputes**: Use `/endmatch` to resolve disputed match results
5. **Regular Maintenance**: Consider resetting MMR between seasons to keep competition fresh