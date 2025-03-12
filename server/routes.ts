import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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

  const httpServer = createServer(app);
  return httpServer;
}
