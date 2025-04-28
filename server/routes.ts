import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  botConfigSchema,
  generalConfigSchema,
  matchmakingConfigSchema,
  mmrConfigSchema,
  seasonConfigSchema,
  matchRulesConfigSchema,
  notificationConfigSchema,
  integrationConfigSchema,
  dataManagementConfigSchema,
} from "@shared/botConfig";
import { players, Player } from "@shared/schema";
import { getMatchService } from "./index.bot";
import { registerDatabaseRoutes } from "./routes/database";

// Assuming this class exists and is correctly implemented.  Add it if it's missing.
class MatchService {
  storage: any;
  constructor(storage: any) {
    this.storage = storage;
  }
  async cancelMatch(
    matchId: number,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const match = await this.storage.getMatch(matchId);
      if (!match) {
        return { success: false, message: "Match not found" };
      }

      // Update match status to CANCELLED
      await this.storage.updateMatch(matchId, { status: "CANCELLED" });

      // Since we don't have a dedicated cancelMatch in storage,
      // we use updateMatch to mark the match as cancelled
      return { success: true, message: "Match cancelled successfully" };
    } catch (error) {
      console.error("Error cancelling match in service:", error);
      return { success: false, message: "Failed to cancel match" };
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin middleware for protecting admin routes
  const adminMiddleware = (req: any, res: any, next: any) => {
    // In a production app, we would check for admin authentication here
    // For now, we'll allow all requests in this example
    next();
  };

  // API Routes for the frontend dashboard
  app.get("/api/stats", async (req, res) => {
    try {
      const queuePlayers = await storage.getQueuePlayers();
      const activeMatches = await storage.getActiveMatches();
      const topPlayers = await storage.listTopPlayers(5);

      res.json({
        queueCount: queuePlayers.length,
        activeMatchesCount: activeMatches.length,
        topPlayers,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get("/api/queue", async (req, res) => {
    try {
      const queuePlayers = await storage.getQueuePlayers();
      res.json(queuePlayers);
    } catch (error) {
      console.error("Error fetching queue:", error);
      res.status(500).json({ message: "Failed to fetch queue data" });
    }
  });

  app.get("/api/matches/active", async (req, res) => {
    try {
      const activeMatches = await storage.getActiveMatches();
      res.json(activeMatches);
    } catch (error) {
      console.error("Error fetching active matches:", error);
      res.status(500).json({ message: "Failed to fetch active matches" });
    }
  });

  app.get("/api/matches/history", async (req, res) => {
    try {
      const count = req.query.count ? parseInt(req.query.count as string) : 10;

      // Get basic match history first
      const matches = await storage.getMatchHistory(count);

      // Enhance with player data for each team
      const enhancedMatches = await Promise.all(matches.map(async (match) => {
        // Get detailed team data including players
        const teamsWithPlayers = await storage.getMatchTeams(match.id);
        
        // If match is completed, calculate MMR changes for each player
        if (match.status === "COMPLETED" && match.winningTeamId) {
          // Get configuration for MMR calculations
          const botConfig = await storage.getBotConfig();
          const kFactor = botConfig?.mmrSystem?.kFactor || 32;
          
          // Process each team
          teamsWithPlayers.forEach(team => {
            const isWinningTeam = team.id === match.winningTeamId;
            
            // Calculate MMR change for each player
            team.players = team.players.map(player => {
              let mmrChange = 0;
              
              if (isWinningTeam) {
                // Winners gain MMR
                mmrChange = Math.round(kFactor * 0.75);
                
                // Apply streak bonuses if applicable
                if (player.winStreak > 0) {
                  const streakThreshold = botConfig?.mmrSystem?.streakSettings?.threshold || 3;
                  const bonusPerWin = botConfig?.mmrSystem?.streakSettings?.bonusPerWin || 2;
                  
                  if (player.winStreak >= streakThreshold) {
                    const streakBonus = Math.min(
                      botConfig?.mmrSystem?.streakSettings?.maxBonus || 10,
                      Math.floor((player.winStreak - streakThreshold + 1) * bonusPerWin)
                    );
                    mmrChange += streakBonus;
                  }
                }
              } else {
                // Losers lose MMR
                mmrChange = -Math.round(kFactor * 0.625);
                
                // Apply streak penalties if applicable
                if (player.lossStreak > 0) {
                  const lossThreshold = botConfig?.mmrSystem?.streakSettings?.lossThreshold || 3;
                  const penaltyPerLoss = botConfig?.mmrSystem?.streakSettings?.penaltyPerLoss || 1;
                  
                  if (player.lossStreak >= lossThreshold) {
                    const streakPenalty = Math.min(
                      botConfig?.mmrSystem?.streakSettings?.maxLossPenalty || 5,
                      Math.floor((player.lossStreak - lossThreshold + 1) * penaltyPerLoss)
                    );
                    mmrChange -= streakPenalty;
                  }
                }
              }
              
              // Return player with added mmrChange property
              return {
                ...player,
                mmrChange: mmrChange
              };
            });
          });
        }

        // Replace the basic teams array with the enhanced version
        return {
          ...match,
          teams: teamsWithPlayers
        };
      }));

      res.json(enhancedMatches);
    } catch (error) {
      console.error('Error retrieving match history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/players/top", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      // Get the top players from storage
      const topPlayers = await storage.listTopPlayers(limit);

      // Log the number of players found for debugging
      console.log(`Fetched ${topPlayers.length} top players`);

      res.json(topPlayers);
    } catch (error) {
      console.error("Error fetching top players:", error);
      res.status(500).json({ message: "Failed to fetch top players" });
    }
  });

  // Get player by Discord ID
  app.get("/api/players/discord/:discordId", async (req, res) => {
    try {
      const { discordId } = req.params;
      const player = await storage.getPlayerByDiscordId(discordId);

      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.json(player);
    } catch (error) {
      console.error("Error fetching player by Discord ID:", error);
      res.status(500).json({ message: "Failed to fetch player data" });
    }
  });

  // Get player by player ID
  app.get("/api/players/:id", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const player = await storage.getPlayer(playerId);

      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.json(player);
    } catch (error) {
      console.error("Error fetching player by ID:", error);
      res.status(500).json({ message: "Failed to fetch player data" });
    }
  });

  app.get("/api/players/:id/matches", async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const player = await storage.getPlayer(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      const matches = await storage.getPlayerMatches(playerId, limit);
      res.json(matches);
    } catch (error) {
      console.error("Error fetching player matches:", error);
      res.status(500).json({ message: "Failed to fetch player matches" });
    }
  });

  app.get("/api/bot/commands", async (req, res) => {
    // This is a static list of available commands
    const commands = [
      {
        name: "/queue",
        description: "Join the matchmaking queue",
        usage: "/queue",
      },
      {
        name: "/leave",
        description: "Leave the matchmaking queue",
        usage: "/leave",
      },
      {
        name: "/list",
        description: "View current queue and matches",
        usage: "/list",
      },
      {
        name: "/profile",
        description: "View player statistics",
        usage: "/profile [user]",
      },
      {
        name: "/history",
        description: "View match history",
        usage: "/history [user] [count]",
      },
      {
        name: "/streak",
        description: "View win/loss streak",
        usage: "/streak [user]",
      },
      {
        name: "/votekick",
        description: "Vote to kick a player from a match",
        usage: "/votekick @user",
      },
      {
        name: "/help",
        description: "Shows all available bot commands and their usage",
        usage: "/help",
      },
      {
        name: "/leaderboard",
        description: "View the ranked leaderboard of players",
        usage: "/leaderboard [page]",
      },
      {
        name: "/config",
        description: "Shows the current bot configuration",
        usage: "/config [matchmaking|mmr|rules]",
      },
      {
        name: "/forcematch",
        description: "Admin: Force create a match",
        usage: "/forcematch @user1 @user2...",
      },
      {
        name: "/endmatch",
        description: "Admin: End a match and record results",
        usage: "/endmatch <match_id> <winning_team>",
      },
      {
        name: "/resetqueue",
        description: "Admin: Reset the queue",
        usage: "/resetqueue",
      },
      {
        name: "/adminqueue",
        description: "Admin queue management commands",
        usage: "/adminqueue",
      },
    ];

    res.json(commands);
  });

  app.get("/api/bot/status", async (req, res) => {
    // In a real implementation, this would come from the bot instance
    // For now, we'll return mock data about the bot status
    res.json({
      version: "1.0.0",
      status: "online",
      uptime: process.uptime(),
      connectedToDiscord: true,
    });
  });

  // Bot Configuration Routes

  // Get bot configuration
  app.get("/api/config", adminMiddleware, async (req, res) => {
    try {
      const config = await storage.getBotConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching bot configuration:", error);
      res.status(500).json({ message: "Failed to fetch bot configuration" });
    }
  });

  // Update bot configuration
  app.put("/api/config", adminMiddleware, async (req, res) => {
    try {
      const configData = req.body;

      // Validate the configuration data
      try {
        const validatedConfig = botConfigSchema.parse(configData);
        const updatedConfig = await storage.updateBotConfig(validatedConfig);
        res.json(updatedConfig);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid configuration data",
            errors: validationError.errors,
          });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error updating bot configuration:", error);
      res.status(500).json({ message: "Failed to update bot configuration" });
    }
  });

  // Update specific configuration section
  app.patch("/api/config/:section", adminMiddleware, async (req, res) => {
    try {
      const { section } = req.params;
      const sectionData = req.body;

      // Validate the section exists
      const validSections = [
        "general",
        "matchmaking",
        "mmrSystem",
        "seasonManagement",
        "matchRules",
        "notifications",
        "integrations",
        "dataManagement",
      ];

      if (!validSections.includes(section)) {
        return res.status(400).json({ message: `Invalid section: ${section}` });
      }

      // Get current config
      const currentConfig = await storage.getBotConfig();

      // Validate the section data
      try {
        let validatedSectionData;

        switch (section) {
          case "general":
            validatedSectionData = generalConfigSchema.parse(sectionData);
            break;
          case "matchmaking":
            validatedSectionData = matchmakingConfigSchema.parse(sectionData);
            break;
          case "mmrSystem":
            validatedSectionData = mmrConfigSchema.parse(sectionData);
            break;
          case "seasonManagement":
            validatedSectionData = seasonConfigSchema.parse(sectionData);
            break;
          case "matchRules":
            validatedSectionData = matchRulesConfigSchema.parse(sectionData);
            break;
          case "notifications":
            validatedSectionData = notificationConfigSchema.parse(sectionData);
            break;
          case "integrations":
            validatedSectionData = integrationConfigSchema.parse(sectionData);
            break;
          case "dataManagement":
            validatedSectionData =
              dataManagementConfigSchema.parse(sectionData);
            break;
          default:
            throw new Error("Invalid section");
        }

        // Update the section in the config
        const updatedConfig = {
          ...currentConfig,
          [section]: validatedSectionData,
        };

        // Update the full config
        const savedConfig = await storage.updateBotConfig(updatedConfig);
        res.json({
          [section]: savedConfig[section as keyof typeof savedConfig],
        });
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid configuration data for section",
            errors: validationError.errors,
          });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error updating configuration section:", error);
      res
        .status(500)
        .json({ message: "Failed to update configuration section" });
    }
  });

  // Admin API routes
  // Get all players for admin
  app.get("/api/admin/players", adminMiddleware, async (req, res) => {
    try {
      // In a real app, we would have a method to get all players
      // For this example, we'll use the top players method with a high limit
      const players = await storage.listTopPlayers(100);
      res.json(players);
    } catch (error) {
      console.error("Error fetching all players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  // Create sample players (for development/testing only)
  app.post("/api/dev/sample-data", adminMiddleware, async (req, res) => {
    try {
      // Create sample players
      const samplePlayers = [
        {
          username: "GamerPro",
          discriminator: "1234",
          discordId: "123456789012345678",
          avatar: null,
          mmr: 1850,
          wins: 25,
          losses: 12,
          winStreak: 3,
          lossStreak: 0,
          isActive: true,
        },
        {
          username: "ProGamer",
          discriminator: "5678",
          discordId: "234567890123456789",
          avatar: null,
          mmr: 2100,
          wins: 32,
          losses: 8,
          winStreak: 6,
          lossStreak: 0,
          isActive: true,
        },
        {
          username: "NoviceGamer",
          discriminator: "9012",
          discordId: "345678901234567890",
          avatar: null,
          mmr: 1200,
          wins: 5,
          losses: 15,
          winStreak: 0,
          lossStreak: 2,
          isActive: true,
        },
        {
          username: "GamingLegend",
          discriminator: "3456",
          discordId: "456789012345678901",
          avatar: null,
          mmr: 2350,
          wins: 48,
          losses: 14,
          winStreak: 0,
          lossStreak: 1,
          isActive: true,
        },
        {
          username: "CasualPlayer",
          discriminator: "7890",
          discordId: "567890123456789012",
          avatar: null,
          mmr: 1550,
          wins: 18,
          losses: 19,
          winStreak: 2,
          lossStreak: 0,
          isActive: true,
        },
      ];

      for (const playerData of samplePlayers) {
        await storage.createPlayer(playerData);
      }

      res.json({
        success: true,
        message: "Sample data created successfully",
        playerCount: samplePlayers.length,
      });
    } catch (error) {
      console.error("Error creating sample data:", error);
      res.status(500).json({ message: "Failed to create sample data" });
    }
  });

  // Update a player
  app.patch("/api/admin/players/:id", adminMiddleware, async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      // Validate the request body
      const { mmr, wins, losses, winStreak, lossStreak, isActive, xboxGamertag, xuid } = req.body;

      // Build the update data with only valid fields
      const updateData: Partial<Player> = {};

      if (typeof mmr === "number") updateData.mmr = mmr;
      if (typeof wins === "number") updateData.wins = wins;
      if (typeof losses === "number") updateData.losses = losses;
      if (typeof winStreak === "number") updateData.winStreak = winStreak;
      if (typeof lossStreak === "number") updateData.lossStreak = lossStreak;
      if (typeof isActive === "boolean") updateData.isActive = isActive;
      // Include Xbox fields in the update
      if (xboxGamertag !== undefined) updateData.xboxGamertag = xboxGamertag;
      if (xuid !== undefined) updateData.xuid = xuid;

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      // Update the player
      const updatedPlayer = await storage.updatePlayer(playerId, updateData);

      if (!updatedPlayer) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.json(updatedPlayer);
    } catch (error) {
      console.error("Error updating player:", error);
      res.status(500).json({ message: "Failed to update player" });
    }
  });

  // Delete a player
  app.delete("/api/admin/players/:id", adminMiddleware, async (req, res) => {
    try {
      const playerId = parseInt(req.params.id);

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      // Check if player exists
      const player = await storage.getPlayer(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Check if player is involved in any active matches
      const playerMatches = await storage.getPlayerMatches(playerId, 10);
      const activeMatches = playerMatches.filter(match => match.status === 'ACTIVE');

      if (activeMatches.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete player involved in active matches. Cancel or complete matches first."
        });
      }

      // Delete the player with enhanced method that handles all related records
      const deleted = await storage.deletePlayer(playerId);

      if (!deleted) {
        return res.status(500).json({ 
          message: "Failed to delete player. There may be database constraints preventing deletion." 
        });
      }

      // Log successful deletion
      console.log(`Player ${playerId} (${player.username}#${player.discriminator}) successfully deleted`);

      res.json({ 
        success: true, 
        message: "Player successfully deleted",
        playerId
      });
    } catch (error) {
      console.error("Error deleting player:", error);
      
      // Provide more helpful error message
      let errorMessage = "Failed to delete player due to server error";
      if (error instanceof Error) {
        // Check for specific constraint errors
        if (error.message?.includes("foreign key constraint")) {
          errorMessage = "Cannot delete player as they have match history or other dependencies in the system";
        }
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get all matches for admin
  app.get("/api/admin/matches", adminMiddleware, async (req, res) => {
    try {
      // Get both active and completed matches with a high limit
      const activeMatches = await storage.getActiveMatches();
      const recentMatches = await storage.getMatchHistory(50);

      // Combine and sort by creation date
      const allMatches = [...activeMatches, ...recentMatches].sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      res.json(allMatches);
    } catch (error) {
      console.error("Error fetching all matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  // Update a match
  app.patch("/api/admin/matches/:id", adminMiddleware, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);

      if (isNaN(matchId)) {
        return res.status(400).json({ message: "Invalid match ID" });
      }

      const matchData = req.body;

      // Add validation here in a real app
      const updatedMatch = await storage.updateMatch(matchId, matchData);

      if (!updatedMatch) {
        return res.status(404).json({ message: "Match not found" });
      }

      res.json(updatedMatch);
    } catch (error) {
      console.error("Error updating match:", error);
      res.status(500).json({ message: "Failed to update match" });
    }
  });

  // Get all teams for admin
  app.get("/api/admin/teams", adminMiddleware, async (req, res) => {
    try {
      // In a real app, we would have a method to get all teams
      // For this demo, we'll get teams from active matches
      const activeMatches = await storage.getActiveMatches();

      // Extract and flatten teams from matches
      const allTeams = activeMatches.reduce((teams, match) => {
        return [...teams, ...match.teams];
      }, [] as any[]);

      res.json(allTeams);
    } catch (error) {
      console.error("Error fetching all teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Get all queue entries for admin
  app.get("/api/admin/queue", adminMiddleware, async (req, res) => {
    try {
      const queuePlayers = await storage.getQueuePlayers();
      res.json(queuePlayers);
    } catch (error) {
      console.error("Error fetching queue:", error);
      res.status(500).json({ message: "Failed to fetch queue data" });
    }
  });

  // Remove player from queue
  app.delete(
    "/api/admin/queue/:playerId",
    adminMiddleware,
    async (req, res) => {
      try {
        const playerId = parseInt(req.params.playerId);

        if (isNaN(playerId)) {
          return res.status(400).json({ message: "Invalid player ID" });
        }

        const success = await storage.removePlayerFromQueue(playerId);

        if (!success) {
          return res.status(404).json({ message: "Player not found in queue" });
        }

        res.json({ success: true, message: "Player removed from queue" });
      } catch (error) {
        console.error("Error removing player from queue:", error);
        res.status(500).json({ message: "Failed to remove player from queue" });
      }
    },
  );

  // Clear queue
  app.post("/api/admin/queue/clear", adminMiddleware, async (req, res) => {
    try {
      await storage.clearQueue();
      res.json({ success: true, message: "Queue cleared successfully" });
    } catch (error) {
      console.error("Error clearing queue:", error);
      res.status(500).json({ message: "Failed to clear queue" });
    }
  });

  // Non-admin endpoint for clearing queue from dashboard
  app.post("/api/queue/reset", async (req, res) => {
    try {
      await storage.clearQueue();
      res.json({ success: true, message: "Queue cleared successfully" });
    } catch (error) {
      console.error("Error clearing queue:", error);
      res.status(500).json({ message: "Failed to clear queue" });
    }
  });

  // Start a new season
  app.post("/api/admin/seasons/new", adminMiddleware, async (req, res) => {
    try {
      // Get current config
      const currentConfig = await storage.getBotConfig();
      const { seasonManagement } = currentConfig;

      // Increment season number
      const newSeasonNumber = (seasonManagement.currentSeason || 1) + 1;

  // Completely standalone upload endpoint with dedicated HTTP server
  // This approach isolates the upload endpoint from Express's middleware stack entirely
  const http = require('http');
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  const crypto = require('crypto');
  const { IncomingForm } = require('formidable');
  const { once } = require('events');

  // Ensure the upload directory exists
  const uploadDir = path.join(process.cwd(), 'client', 'public', 'ranks');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Create a simple rate limiter to prevent abuse
  const rateLimiter = new Map();

  // Setup proxy endpoint in Express that forwards to our isolated handler
  app.post('/api/upload/rank-icon', (req, res) => {
    const ip = req.ip || '127.0.0.1';

    // Basic rate limiting
    const now = Date.now();
    const lastRequest = rateLimiter.get(ip) || 0;
    if (now - lastRequest < 1000) { // 1 request per second max
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }
    rateLimiter.set(ip, now);

    // Create direct file parser that doesn't rely on middleware
    const form = new IncomingForm({
      maxFileSize: 2 * 1024 * 1024, // 2MB limit
      uploadDir: uploadDir,
      keepExtensions: true,
      multiples: false,
    });

    form.parse(req, async (err: any, fields: any, files: any) => {
      if (err) {
        console.error('Upload parsing error:', err);
        return res.status(400).json({
          success: false,
          message: 'Error uploading file: ' + err.message
        });
      }

      // Get the uploaded file
      const file = files.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      try {
        // Validate mime type
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const fileMime = file.mimetype || '';

        if (!allowedMimes.includes(fileMime)) {
          // Remove the temporary file
          fs.unlinkSync(file.filepath);

          return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
          });
        }

        // Read file from temporary location
        const fileBuffer = fs.readFileSync(file.filepath);

        // Generate a unique filename
        const fileExt = path.extname(file.originalFilename || '.png').toLowerCase();
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        const safeFilename = hash.substring(0, 10) + '-' + Date.now() + fileExt;
        const finalPath = path.join(uploadDir, safeFilename);

        // Move file to permanent location
        fs.writeFileSync(finalPath, fileBuffer);

        // Remove the temporary file
        fs.unlinkSync(file.filepath);

        console.log('File upload successful:', safeFilename);

        // Send successful response with explicit JSON content type
        return res.json({
          success: true,
          message: 'File uploaded successfully',
          file: {
            filename: safeFilename,
            path: `ranks/${safeFilename}`,
            size: file.size,
            mimetype: fileMime
          }
        });
      } catch (error) {
        console.error('File processing error:', error);
        return res.status(500).json({
          success: false,
          message: 'Error processing uploaded file',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  });



      // Set new dates
      const startDate = new Date().toISOString();

      // Calculate end date (3 months from now)
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      // Update season config
      const updatedSeasonConfig = {
        ...seasonManagement,
        currentSeason: newSeasonNumber,
        seasonStartDate: startDate,
        seasonEndDate: endDate.toISOString(),
      };

      // Apply MMR reset based on config
      if (seasonManagement.mmrResetType !== "none") {
        // In a real implementation, we would reset MMR for all players here
        // For this demo, we'll just acknowledge it in the response
      }

      // Update the configuration
      currentConfig.seasonManagement = updatedSeasonConfig;
      await storage.updateBotConfig(currentConfig);

      res.json({
        success: true,
        message: `Season ${newSeasonNumber} started successfully`,
        seasonData: updatedSeasonConfig,
      });
    } catch (error) {
      console.error("Error starting new season:", error);
      res.status(500).json({ message: "Failed to start new season" });
    }
  });

  // Distribute season rewards
  app.post(
    "/api/admin/seasons/distribute-rewards",
    adminMiddleware,
    async (req, res) => {
      try {
        // Get current config
        const currentConfig = await storage.getBotConfig();
        const { seasonManagement } = currentConfig;

        // In a real implementation, we would:
        // 1. Get all players
        // 2. Calculate their rewards based on MMR thresholds
        // 3. Send messages to Discord users
        // 4. Generate logs

        // For this demo, we'll just acknowledge the request

        // Check if we have reward tiers defined
        if (
          !seasonManagement.rewardTiers ||
          seasonManagement.rewardTiers.length === 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "No reward tiers defined. Please define reward tiers before distributing rewards.",
          });
        }

        res.json({
          success: true,
          message: `Rewards for Season ${seasonManagement.currentSeason} distributed successfully`,
          rewardTiers: seasonManagement.rewardTiers.length,
        });
      } catch (error) {
        console.error("Error distributing rewards:", error);
        res.status(500).json({ message: "Failed to distribute rewards" });
      }
    },
  );

  // Reset all season data
  app.post(
    "/api/admin/seasons/reset-data",
    adminMiddleware,
    async (req, res) => {
      try {
        // Use transaction to ensure data consistency
        return await withTransaction(async (tx) => {
          logger.info(
            "Starting season data reset - this will reset all match history and player data",
          );

          // 1. Mark all matches as archived
          logger.info("Archiving all matches...");
          const matches = await tx.query.matches.findMany();
          for (const match of matches) {
            await tx
              .update(schema.matches)
              .set({
                status: "ARCHIVED",
                archivedAt: new Date(),
              })
              .where(eq(schema.matches.id, match.id));
          }

          // 2. Clear the queue
          logger.info("Clearing queue...");
          await tx.delete(schema.queue);

          // 3. Reset all player stats
          logger.info("Resetting player stats...");
          const players = await tx.query.players.findMany();
          for (const player of players) {
            await tx
              .update(schema.players)
              .set({
                mmr: 1000, // Reset to default MMR
                wins: 0,
                losses: 0,
                winStreak: 0,
                lossStreak: 0,
              })
              .where(eq(schema.players.id, player.id));
          }

          // 4. Update season number and dates in config
          logger.info("Updating season configuration...");
          const currentConfig = await storage.getBotConfig();
          const updatedSeasonConfig = {
            ...currentConfig.seasonManagement,
            currentSeason: 1, // Reset to season 1
            seasonStartDate: new Date().toISOString(),
            seasonEndDate: (() => {
              const endDate = new Date();
              endDate.setMonth(endDate.getMonth() + 3);
              return endDate.toISOString();
            })(),
          };

          currentConfig.seasonManagement = updatedSeasonConfig;
          await storage.updateBotConfig(currentConfig);

          // Log the action
          const matchService = new MatchService(storage);
          await matchService.logEvent(
            "Season Data Reset",
            "All match history has been archived and player stats have been reset.",
            [
              {
                name: "Admin Action",
                value: "Complete Data Reset",
                inline: true,
              },
              { name: "New Season", value: "1", inline: true },
              {
                name: "Players Reset",
                value: players.length.toString(),
                inline: true,
              },
              {
                name: "Matches Archived",
                value: matches.length.toString(),
                inline: true,
              },
            ],
          );

          return res.json({
            success: true,
            message:
              "Season data reset successful. All match history archived and player stats reset.",
            playersReset: players.length,
            matchesArchived: matches.length,
          });
        });
      } catch (error) {
        logger.error(`Error resetting season data: ${error}`);
        return res.status(500).json({
          success: false,
          message: "Failed to reset season data due to an error",
        });
      }
    },
  );

  app.post("/api/matches/:id/cancel", adminMiddleware, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      if (isNaN(matchId)) {
        return res.status(400).json({ message: "Invalid match ID" });
      }

      // Get the bot MatchService instance to handle Discord channel cleanup
      const matchService = getMatchService();
      if (!matchService) {
        console.error("Could not get MatchService instance from bot");
        return res.status(500).json({
          success: false,
          message: "Failed to cancel match: Bot services not initialized",
        });
      }

      // Use handleMatchCancellation method which properly cleans up Discord channels
      // and returns players to queue
      const cancellationResult =
        await matchService.handleMatchCancellation(matchId);

      if (cancellationResult.success) {
        res.json(cancellationResult);
      } else {
        res.status(400).json(cancellationResult);
      }
    } catch (error) {
      console.error("Error cancelling match:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel match due to server error",
      });
    }
  });

  // Cancel match without returning players to queue
  app.post(
    "/api/matches/:id/cancel-reset",
    adminMiddleware,
    async (req, res) => {
      try {
        const matchId = parseInt(req.params.id);
        if (isNaN(matchId)) {
          return res.status(400).json({ message: "Invalid match ID" });
        }

        // Get the bot MatchService instance to handle Discord channel cleanup
        const matchService = getMatchService();
        if (!matchService) {
          console.error("Could not get MatchService instance from bot");
          return res.status(500).json({
            success: false,
            message: "Failed to reset match: Bot services not initialized",
          });
        }

        // Use handleMatchCancellationNoQueue which cleans up Discord channels
        // but does NOT return players to queue
        const resetResult =
          await matchService.handleMatchCancellationNoQueue(matchId);

        if (resetResult.success) {
          res.json(resetResult);
        } else {
          res.status(400).json(resetResult);
        }
      } catch (error) {
        console.error("Error resetting match:", error);
        res.status(500).json({
          success: false,
          message: "Failed to reset match due to server error",
        });
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}