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
      rankTiers = await storage.getRankTiers() || [];
      if (rankTiers.length === 0) {
        logger.warn(`No rank tiers found when processing profile for user ${targetUser.id}`);
      }
      playerRank = getPlayerRank(player.mmr, rankTiers);
      if (!playerRank && rankTiers.length > 0) {
        logger.warn(`Could not determine rank for player with MMR ${player.mmr}`);
      }
    } catch (rankError) {
      logger.error(`Error retrieving rank information: ${rankError}`);
      // Continue without rank information
    }
    
    // Find rank icon if available - with simplified approach
    let rankIconAttachment = null;
    if (playerRank && playerRank.name) {
      try {
        // Get base path for rank icons
        const basePath = path.join(process.cwd(), 'client', 'public', 'ranks');
        
        // Check if directory exists to avoid file system errors
        if (!fs.existsSync(basePath)) {
          logger.warn(`Rank icons directory does not exist: ${basePath}`);
        } else {
          // Generate simpler filename variations
          const rankName = playerRank.name.replace(/\s+/g, '');
          const simpleVariations = [
            rankName,                                               // as is
            rankName.toLowerCase(),                                // lowercase
            rankName.charAt(0).toUpperCase() + rankName.slice(1)   // Title case
          ];
          
          // Try to find any matching file
          let iconFile = null;
          
          // List files in the directory
          try {
            const files = fs.readdirSync(basePath);
            
            // Try to find a matching file using case-insensitive comparison
            for (const file of files) {
              // Check if any variation matches the filename (ignoring extension)
              const fileBaseName = path.basename(file, path.extname(file));
              for (const variation of simpleVariations) {
                if (fileBaseName.toLowerCase() === variation.toLowerCase()) {
                  iconFile = file;
                  break;
                }
              }
              if (iconFile) break;
            }
            
            if (iconFile) {
              const iconPath = path.join(basePath, iconFile);
              rankIconAttachment = { attachment: iconPath, name: 'rank.png' };
              logger.info(`Found rank icon at: ${iconPath}`);
            } else {
              logger.warn(`Could not find rank icon for rank: ${playerRank.name} in directory listing`);
            }
          } catch (readDirError) {
            logger.error(`Could not read rank icons directory: ${readDirError}`);
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
