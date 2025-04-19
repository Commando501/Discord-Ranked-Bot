import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User,
} from "discord.js";
import { storage } from "../../storage";
import { logger } from "../../bot/utils/logger";
import { PlayerService } from "../../bot/services/playerService";
import { MatchService } from "../../bot/services/matchService";
import { getPlayerRank } from "../../../shared/rankSystem";
import * as fs from "fs";
import * as path from "path";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your or another player's profile and statistics")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user whose profile you want to view")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Get the target user
    const targetUser: User =
      interaction.options.getUser("user") || interaction.user;

    // Get services
    const playerService = new PlayerService(storage);
    const matchService = new MatchService(storage);

    // Get player data
    const player = await playerService.getPlayerByDiscordId(targetUser.id);

    if (!player) {
      const embed = new EmbedBuilder()
        .setColor("#ED4245") // Discord red
        .setTitle("Profile Not Found")
        .setDescription(
          `${targetUser.username} has not played any matches yet.`,
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // Calculate win rate
    const totalGames = player.wins + player.losses;
    const winRate =
      totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;

    // Get rank tiers and determine player's rank
    let rankTiers = [];
    let playerRank = null;
    try {
      // First try to get rank tiers from database/storage
      rankTiers = await storage.getRankTiers() || [];
      
      if (rankTiers.length === 0) {
        logger.warn(`No rank tiers found in storage when processing profile for user ${targetUser.id}, checking config file`);
        
        // If no tiers in database, try to get them from config
        try {
          const configPath = path.join(process.cwd(), 'discordbot-config.json');
          if (fs.existsSync(configPath)) {
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (configData.seasonManagement && configData.seasonManagement.rankTiers && 
                configData.seasonManagement.rankTiers.length > 0) {
              rankTiers = configData.seasonManagement.rankTiers;
              logger.info(`Loaded ${rankTiers.length} rank tiers from config file`);
            }
          }
        } catch (configError) {
          logger.error(`Error loading rank tiers from config file: ${configError}`);
        }
      }
      
      // Log the loaded rank tiers to help debug
      if (rankTiers.length > 0) {
        logger.info(`Found ${rankTiers.length} rank tiers. First tier: ${JSON.stringify(rankTiers[0])}, Last tier: ${JSON.stringify(rankTiers[rankTiers.length-1])}`);
        
        // First, try to load directly from discordbot-config.json to ensure we get the full set of tiers
        try {
          const configPath = path.join(process.cwd(), 'discordbot-config.json');
          if (fs.existsSync(configPath)) {
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (configData.seasonManagement && configData.seasonManagement.rankTiers && 
                configData.seasonManagement.rankTiers.length > 0) {
              // Replace with config ranks if they exist - this ensures we use the complete set
              rankTiers = configData.seasonManagement.rankTiers;
              logger.info(`Using ${rankTiers.length} detailed rank tiers directly from config file`);
            }
          }
        } catch (configError) {
          logger.error(`Error loading detailed rank tiers from config: ${configError}`);
        }
        
        // COMPLETE ALGORITHM REWRITE:
        // Each tier's threshold is the LOWER bound of its range
        // The upper bound is the next tier's threshold - 1
        
        // Sort tiers by threshold in ascending order
        const sortedTiers = [...rankTiers].sort((a, b) => a.mmrThreshold - b.mmrThreshold);
        
        // Print all thresholds for debugging
        const thresholds = sortedTiers.map(tier => `${tier.name}: ${tier.mmrThreshold}`).join(', ');
        logger.info(`All tier thresholds in ascending order: ${thresholds}`);
        
        // Find the appropriate tier by checking MMR ranges explicitly
        let foundTier = null;
        
        // For each tier, explicitly define its range and check if player MMR falls within it
        for (let i = 0; i < sortedTiers.length; i++) {
          const currentTier = sortedTiers[i];
          const nextTier = i < sortedTiers.length - 1 ? sortedTiers[i + 1] : null;
          
          // Lower bound is inclusive (>=), upper bound is exclusive (<)
          const lowerBound = currentTier.mmrThreshold;
          const upperBound = nextTier ? nextTier.mmrThreshold : Number.MAX_SAFE_INTEGER;
          
          logger.info(`Checking tier ${currentTier.name}: Range ${lowerBound} to ${upperBound-1} against MMR ${player.mmr}`);
          
          if (player.mmr >= lowerBound && player.mmr < upperBound) {
            foundTier = currentTier;
            logger.info(`MATCH FOUND: Player MMR ${player.mmr} belongs to ${foundTier.name}`);
            logger.info(`This tier's range is ${lowerBound} to ${upperBound-1}`);
            break;
          }
        }
        
        // If no tier found, use the lowest one
        if (!foundTier && sortedTiers.length > 0) {
          foundTier = sortedTiers[0];
          logger.info(`FALLBACK: Using lowest tier ${foundTier.name} for MMR ${player.mmr}`);
        }
        
        if (foundTier) {
          playerRank = foundTier;
          
          // Improve debugging logs to confirm correct tier selection
          const tierIndex = sortedTiers.findIndex(t => t.name === playerRank.name);
          const nextTierThreshold = tierIndex < sortedTiers.length - 1 ? sortedTiers[tierIndex + 1].mmrThreshold : "MAX";
          
          // Show exact tier boundaries for easier verification
          logger.info(`CORRECTED ALGORITHM: Selected rank "${playerRank.name}" for player with MMR ${player.mmr}.`);
          logger.info(`This tier's threshold is ${playerRank.mmrThreshold}, next tier threshold is ${nextTierThreshold}.`);
          logger.info(`Valid MMR range for ${playerRank.name}: ${playerRank.mmrThreshold} up to but not including ${nextTierThreshold}.`);
        }
        
        // If no tier is found, use the lowest tier
        if (!playerRank && sortedTiers.length > 0) {
          playerRank = sortedTiers[sortedTiers.length - 1];
        }
        
        if (!playerRank) {
          logger.warn(`Could not determine rank for player with MMR ${player.mmr}`);
        }
      } else {
        logger.warn(`No rank tiers available to determine rank for player with MMR ${player.mmr}`);
        // Only use default tiers as absolute fallback
        playerRank = getPlayerRank(player.mmr, []);
      }
      
      // Log the exact rank information to verify
      if (playerRank) {
        logger.info(`Retrieved player rank: ${JSON.stringify(playerRank)}`);
      }
    } catch (rankError) {
      logger.error(`Error retrieving rank information: ${rankError}`);
      // Continue without rank information
    }
    
    // Find rank icon if available - with enhanced approach
    let rankIconAttachment = null;
    if (playerRank && playerRank.name) {
      try {
        // Get base path for rank icons
        const basePath = path.join(process.cwd(), 'client', 'public', 'ranks');
        
        // Check if directory exists to avoid file system errors
        if (!fs.existsSync(basePath)) {
          logger.warn(`Rank icons directory does not exist: ${basePath}`);
        } else {
          // List files in the directory first
          const files = fs.readdirSync(basePath);
          
          // Extract rank base and number if format is like "Silver 1"
          let rankBase = playerRank.name;
          let rankNumber = "";
          
          if (playerRank.name.includes(' ')) {
            const parts = playerRank.name.split(' ');
            if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
              rankBase = parts[0];
              rankNumber = parts[1];
            }
          }
          
          // Generate all possible filename variations
          const variations = [
            // Exact match
            playerRank.name.replace(/\s+/g, ''),
            playerRank.name.toLowerCase().replace(/\s+/g, ''),
            
            // Base name with number combinations
            `${rankBase}${rankNumber}`,
            `${rankBase.toLowerCase()}${rankNumber}`,
            `${rankBase}${rankNumber}.png`,
            `${rankBase.toLowerCase()}${rankNumber}.png`,
            
            // Just base name (for generic rank icons)
            rankBase,
            rankBase.toLowerCase(),
            
            // With file extensions
            `${playerRank.name.replace(/\s+/g, '')}.png`,
            `${playerRank.name.toLowerCase().replace(/\s+/g, '')}.png`,
            
            // Try other common formats
            `${rankBase}`,
            `${rankBase.toLowerCase()}`
          ];
          
          logger.info(`Trying to find icon for rank: ${playerRank.name}, generated variations: ${variations.join(', ')}`);
          
          // Try to find any matching file
          let iconFile = null;
          
          // Loop through all files in the directory
          for (const file of files) {
            const fileBaseName = path.basename(file, path.extname(file)).toLowerCase();
            
            // Try all variations against this file
            for (const variation of variations) {
              const variationLower = variation.toLowerCase();
              // Check if file contains this variation or variation contains file name
              if (fileBaseName === variationLower || 
                  fileBaseName.includes(variationLower) || 
                  variationLower.includes(fileBaseName)) {
                iconFile = file;
                logger.info(`Found matching file ${file} for variation ${variation}`);
                break;
              }
            }
            
            if (iconFile) break;
          }
          
          // If still no match, try a more aggressive partial match
          if (!iconFile) {
            for (const file of files) {
              const fileBaseName = path.basename(file, path.extname(file)).toLowerCase();
              
              // Try to match just the rank base name
              if (fileBaseName.includes(rankBase.toLowerCase()) || 
                  rankBase.toLowerCase().includes(fileBaseName)) {
                iconFile = file;
                logger.info(`Found partial match ${file} for rank base ${rankBase}`);
                break;
              }
            }
          }
          
          if (iconFile) {
            const iconPath = path.join(basePath, iconFile);
            rankIconAttachment = { attachment: iconPath, name: 'rank.png' };
            logger.info(`Using rank icon at: ${iconPath}`);
          } else {
            logger.warn(`Could not find any rank icon for rank: ${playerRank.name} in directory listing`);
          }
        }
      } catch (error) {
        logger.error(`Error in rank icon resolution process: ${error}`);
        // Continue without the rank icon if there's an error
      }
    }

    // Get recent matches for this player
    let matches = [];
    try {
      matches = await storage.getPlayerMatches(player.id, 5) || [];
    } catch (matchError) {
      logger.error(`Error retrieving player match history: ${matchError}`);
      // Continue without match history
    }

    // Create profile embed with rank info
    const embed = new EmbedBuilder()
      .setColor(playerRank?.color || "#5865F2")
      .setTitle(`${targetUser.username}'s Profile`)
      .setThumbnail(rankIconAttachment ? 'attachment://rank.png' : targetUser.displayAvatarURL())
      .addFields(
        { 
          name: "Rank & MMR", 
          value: `${playerRank?.name || "Unranked"} (${player.mmr} MMR)`, 
          inline: true 
        },
        {
          name: "Win/Loss",
          value: `${player.wins}W / ${player.losses}L`,
          inline: true,
        },
        { name: "Win Rate", value: `${winRate}%`, inline: true },
        {
          name: "Current Streak",
          value: getStreakText(player.winStreak, player.lossStreak),
          inline: true,
        },
      );

    // Add match history if available
    if (matches.length > 0) {
      let historyText = "";

      for (const match of matches) {
        // Determine if player won the match
        const playerWon =
          match.status === "COMPLETED" &&
          match.winningTeamId === match.playerTeamId;

        // Determine match result text
        let resultText = "🔄 In Progress";
        if (match.status === "COMPLETED") {
          resultText = playerWon ? "🟢" : "🔴";
        } else if (match.status === "CANCELLED") {
          resultText = "⚫";
        }

        // Format creation date
        const matchDate = new Date(match.createdAt).toLocaleDateString();

        // Calculate MMR change - might be undefined in some match records
        const mmrChangeText =
          match.mmrChange !== undefined
            ? match.mmrChange > 0
              ? `+${match.mmrChange}`
              : match.mmrChange
            : "";

        // Build the match history line
        historyText += `${resultText} | Match #${match.id} | ${match.playerTeamName || "Unknown"}${mmrChangeText ? ` | MMR: ${mmrChangeText}` : "" } | ${matchDate}\n`;
      }

      embed.addFields({ name: "Recent Matches", value: historyText });
    } else {
      embed.addFields({ name: "Recent Matches", value: "No recent matches" });
    }

    embed.setFooter({
      text: `Player since ${new Date(player.createdAt).toLocaleDateString()}`,
    });

    // Send the reply with the rank icon attachment if available
    const replyOptions = {
      embeds: [embed],
      files: rankIconAttachment ? [rankIconAttachment] : []
    };

    await interaction.editReply(replyOptions);
  } catch (error) {
    // Generate a unique tracking ID for this error
    const errorId = `prof-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
    
    logger.error(`Error executing profile command [${errorId}]`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      targetUserId: targetUser.id,
      errorContext: {
        command: "profile",
        errorId,
        timestamp: new Date().toISOString()
      }
    });

    // Log more details about the context of the error
    console.error(`PROFILE ERROR [${errorId}]:`, error);
    
    // Try to provide a more specific error message with tracking ID
    let errorMessage = `There was an error retrieving the profile information. Please try again later. (Error ID: ${errorId})`;
    
    if (error instanceof Error) {
      if (error.message.includes("ENOENT") && error.message.includes("ranks")) {
        errorMessage = `Could not load rank icon images. Profile information is still available. (Error ID: ${errorId})`;
      } else if (error.message.includes("getPlayerByDiscordId")) {
        errorMessage = `Could not retrieve player data. Please try again later. (Error ID: ${errorId})`;
      } else if (error.message.includes("Cannot read properties of null") || error.message.includes("undefined")) {
        errorMessage = `Missing data in player profile. Our team has been notified. (Error ID: ${errorId})`;
      }
    }

    const errorEmbed = new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle("Error")
      .setDescription(errorMessage);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

function getStreakText(winStreak: number, lossStreak: number): string {
  if (winStreak > 0) {
    return `${winStreak} wins 🔥`;
  } else if (lossStreak > 0) {
    return `${lossStreak} losses 💔`;
  } else {
    return "No streak";
  }
}
