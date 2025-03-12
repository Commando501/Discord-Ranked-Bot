import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeBot } from "./discord/bot";
import { logger } from "./utils/logger";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // API routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Player endpoints
  app.get('/api/players', async (_req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error) {
      logger.error('Error fetching players', { error });
      res.status(500).json({ message: 'Error fetching players' });
    }
  });

  app.get('/api/players/:discordId', async (req, res) => {
    try {
      const player = await storage.getPlayerByDiscordId(req.params.discordId);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      res.json(player);
    } catch (error) {
      logger.error('Error fetching player', { error, discordId: req.params.discordId });
      res.status(500).json({ message: 'Error fetching player' });
    }
  });

  // Queue endpoints
  app.get('/api/queue', async (_req, res) => {
    try {
      const queue = await storage.getAllQueueEntries();
      
      // Get player details for each queue entry
      const queueWithPlayerDetails = await Promise.all(
        queue.map(async (entry) => {
          const player = await storage.getPlayer(entry.playerId);
          return {
            ...entry,
            player: player || { discordUsername: 'Unknown' }
          };
        })
      );
      
      res.json(queueWithPlayerDetails);
    } catch (error) {
      logger.error('Error fetching queue', { error });
      res.status(500).json({ message: 'Error fetching queue' });
    }
  });

  // Matches endpoints
  app.get('/api/matches/active', async (_req, res) => {
    try {
      const matches = await storage.getActiveMatches();
      
      // Get details for each match
      const matchesWithDetails = await Promise.all(
        matches.map(async (match) => {
          const teams = await storage.getTeamsByMatchId(match.id);
          
          const teamsWithPlayers = await Promise.all(
            teams.map(async (team) => {
              const teamPlayers = await storage.getTeamPlayers(team.id);
              
              const players = await Promise.all(
                teamPlayers.map(async (tp) => {
                  return await storage.getPlayer(tp.playerId);
                })
              );
              
              return {
                ...team,
                players: players.filter(p => p !== undefined)
              };
            })
          );
          
          return {
            ...match,
            teams: teamsWithPlayers
          };
        })
      );
      
      res.json(matchesWithDetails);
    } catch (error) {
      logger.error('Error fetching active matches', { error });
      res.status(500).json({ message: 'Error fetching active matches' });
    }
  });

  app.get('/api/matches/player/:discordId', async (req, res) => {
    try {
      const player = await storage.getPlayerByDiscordId(req.params.discordId);
      
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      const matches = await storage.getMatchesForPlayer(player.id, 10); // Get last 10 matches
      
      res.json(matches);
    } catch (error) {
      logger.error('Error fetching player matches', { error, discordId: req.params.discordId });
      res.status(500).json({ message: 'Error fetching player matches' });
    }
  });

  // Stats endpoints
  app.get('/api/stats', async (_req, res) => {
    try {
      const players = await storage.getAllPlayers();
      const queueEntries = await storage.getAllQueueEntries();
      const activeMatches = await storage.getActiveMatches();
      
      // Count matches played today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const allMatches = Array.from((await storage.getActiveMatches()).values());
      const matchesToday = allMatches.filter(match => 
        match.createdAt >= today
      ).length;
      
      res.json({
        activePlayers: players.length,
        playersInQueue: queueEntries.length,
        activeMatches: activeMatches.length,
        matchesToday
      });
    } catch (error) {
      logger.error('Error fetching stats', { error });
      res.status(500).json({ message: 'Error fetching stats' });
    }
  });

  // Initialize Discord bot
  try {
    await initializeBot();
    logger.info('Discord bot initialized');
  } catch (error) {
    logger.error('Failed to initialize Discord bot', { error });
  }

  return httpServer;
}
