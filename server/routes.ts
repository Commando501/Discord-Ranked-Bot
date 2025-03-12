import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin middleware for protecting admin routes
  const adminMiddleware = (req: any, res: any, next: any) => {
    // In a production app, we would check for admin authentication here
    // For now, we'll allow all requests in this example
    next();
  };
  
  // API Routes for the frontend dashboard
  app.get('/api/stats', async (req, res) => {
    try {
      const queuePlayers = await storage.getQueuePlayers();
      const activeMatches = await storage.getActiveMatches();
      const topPlayers = await storage.listTopPlayers(5);
      
      res.json({
        queueCount: queuePlayers.length,
        activeMatchesCount: activeMatches.length,
        topPlayers
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch statistics' });
    }
  });

  app.get('/api/queue', async (req, res) => {
    try {
      const queuePlayers = await storage.getQueuePlayers();
      res.json(queuePlayers);
    } catch (error) {
      console.error('Error fetching queue:', error);
      res.status(500).json({ message: 'Failed to fetch queue data' });
    }
  });

  app.get('/api/matches/active', async (req, res) => {
    try {
      const activeMatches = await storage.getActiveMatches();
      res.json(activeMatches);
    } catch (error) {
      console.error('Error fetching active matches:', error);
      res.status(500).json({ message: 'Failed to fetch active matches' });
    }
  });

  app.get('/api/matches/history', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const matchHistory = await storage.getMatchHistory(limit);
      res.json(matchHistory);
    } catch (error) {
      console.error('Error fetching match history:', error);
      res.status(500).json({ message: 'Failed to fetch match history' });
    }
  });

  app.get('/api/players/top', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const topPlayers = await storage.listTopPlayers(limit);
      res.json(topPlayers);
    } catch (error) {
      console.error('Error fetching top players:', error);
      res.status(500).json({ message: 'Failed to fetch top players' });
    }
  });

  app.get('/api/players/:discordId', async (req, res) => {
    try {
      const { discordId } = req.params;
      const player = await storage.getPlayerByDiscordId(discordId);
      
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      res.json(player);
    } catch (error) {
      console.error('Error fetching player:', error);
      res.status(500).json({ message: 'Failed to fetch player data' });
    }
  });

  app.get('/api/players/:id/matches', async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(playerId)) {
        return res.status(400).json({ message: 'Invalid player ID' });
      }
      
      const player = await storage.getPlayer(playerId);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      const matches = await storage.getPlayerMatches(playerId, limit);
      res.json(matches);
    } catch (error) {
      console.error('Error fetching player matches:', error);
      res.status(500).json({ message: 'Failed to fetch player matches' });
    }
  });

  app.get('/api/bot/commands', async (req, res) => {
    // This is a static list of available commands
    const commands = [
      { name: '/queue', description: 'Join the matchmaking queue', usage: '/queue' },
      { name: '/leave', description: 'Leave the matchmaking queue', usage: '/leave' },
      { name: '/list', description: 'View current queue and matches', usage: '/list' },
      { name: '/profile', description: 'View player statistics', usage: '/profile [user]' },
      { name: '/history', description: 'View match history', usage: '/history [user] [count]' },
      { name: '/streak', description: 'View win/loss streak', usage: '/streak [user]' },
      { name: '/votekick', description: 'Vote to kick a player from a match', usage: '/votekick @user' },
      { name: '/forcematch', description: 'Admin: Force create a match', usage: '/forcematch @user1 @user2...' },
      { name: '/endmatch', description: 'Admin: End a match and record results', usage: '/endmatch <match_id> <winning_team>' },
      { name: '/resetqueue', description: 'Admin: Reset the queue', usage: '/resetqueue' }
    ];
    
    res.json(commands);
  });

  app.get('/api/bot/status', async (req, res) => {
    // In a real implementation, this would come from the bot instance
    // For now, we'll return mock data about the bot status
    res.json({
      version: '1.0.0',
      status: 'online',
      uptime: process.uptime(),
      connectedToDiscord: true
    });
  });

  // Admin API routes
  // Get all players for admin
  app.get('/api/admin/players', adminMiddleware, async (req, res) => {
    try {
      // In a real app, we would have a method to get all players
      // For this example, we'll use the top players method with a high limit
      const players = await storage.listTopPlayers(100);
      res.json(players);
    } catch (error) {
      console.error('Error fetching all players:', error);
      res.status(500).json({ message: 'Failed to fetch players' });
    }
  });

  // Update a player
  app.patch('/api/admin/players/:id', adminMiddleware, async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      
      if (isNaN(playerId)) {
        return res.status(400).json({ message: 'Invalid player ID' });
      }
      
      const playerData = req.body;
      
      // Add validation here in a real app
      const updatedPlayer = await storage.updatePlayer(playerId, playerData);
      
      if (!updatedPlayer) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      res.json(updatedPlayer);
    } catch (error) {
      console.error('Error updating player:', error);
      res.status(500).json({ message: 'Failed to update player' });
    }
  });

  // Get all matches for admin
  app.get('/api/admin/matches', adminMiddleware, async (req, res) => {
    try {
      // Get both active and completed matches with a high limit
      const activeMatches = await storage.getActiveMatches();
      const recentMatches = await storage.getMatchHistory(50);
      
      // Combine and sort by creation date
      const allMatches = [...activeMatches, ...recentMatches].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      res.json(allMatches);
    } catch (error) {
      console.error('Error fetching all matches:', error);
      res.status(500).json({ message: 'Failed to fetch matches' });
    }
  });

  // Update a match
  app.patch('/api/admin/matches/:id', adminMiddleware, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      
      if (isNaN(matchId)) {
        return res.status(400).json({ message: 'Invalid match ID' });
      }
      
      const matchData = req.body;
      
      // Add validation here in a real app
      const updatedMatch = await storage.updateMatch(matchId, matchData);
      
      if (!updatedMatch) {
        return res.status(404).json({ message: 'Match not found' });
      }
      
      res.json(updatedMatch);
    } catch (error) {
      console.error('Error updating match:', error);
      res.status(500).json({ message: 'Failed to update match' });
    }
  });

  // Get all teams for admin
  app.get('/api/admin/teams', adminMiddleware, async (req, res) => {
    try {
      // In a real app, we would have a method to get all teams
      // For this demo, we'll get teams from active matches
      const activeMatches = await storage.getActiveMatches();
      
      // Extract and flatten teams from matches
      const allTeams = activeMatches.reduce((teams, match) => {
        return [...teams, ...match.teams];
      }, []);
      
      res.json(allTeams);
    } catch (error) {
      console.error('Error fetching all teams:', error);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  // Get all queue entries for admin
  app.get('/api/admin/queue', adminMiddleware, async (req, res) => {
    try {
      const queuePlayers = await storage.getQueuePlayers();
      res.json(queuePlayers);
    } catch (error) {
      console.error('Error fetching queue:', error);
      res.status(500).json({ message: 'Failed to fetch queue data' });
    }
  });

  // Remove player from queue
  app.delete('/api/admin/queue/:playerId', adminMiddleware, async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      
      if (isNaN(playerId)) {
        return res.status(400).json({ message: 'Invalid player ID' });
      }
      
      const success = await storage.removePlayerFromQueue(playerId);
      
      if (!success) {
        return res.status(404).json({ message: 'Player not found in queue' });
      }
      
      res.json({ success: true, message: 'Player removed from queue' });
    } catch (error) {
      console.error('Error removing player from queue:', error);
      res.status(500).json({ message: 'Failed to remove player from queue' });
    }
  });

  // Clear queue
  app.post('/api/admin/queue/clear', adminMiddleware, async (req, res) => {
    try {
      await storage.clearQueue();
      res.json({ success: true, message: 'Queue cleared successfully' });
    } catch (error) {
      console.error('Error clearing queue:', error);
      res.status(500).json({ message: 'Failed to clear queue' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
