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
    const rankTiers = await storage.getRankTiers();
    const playerRank = getPlayerRank(player.mmr, rankTiers);
    
    // Find rank icon if available
    let rankIconAttachment = null;
    if (playerRank) {
      try {
        const rankName = playerRank.name.replace(/\s+/g, '');
        
        // Generate multiple possible variations of the filename
        const possibleNames = [
          rankName,                                                             // Exact match
          rankName.toLowerCase(),                                              // All lowercase
          rankName.charAt(0).toUpperCase() + rankName.slice(1).toLowerCase(),  // First letter capitalized
          rankName.toUpperCase(),                                              // All uppercase
          // Try with common separators removed
          rankName.replace(/[_\-\s]/g, ''),
          // Try with numbers at different positions
          ...rankName.match(/(\D+)(\d+)/) ? 
            [`${RegExp.$1}${RegExp.$2}`, `${RegExp.$1}_${RegExp.$2}`, `${RegExp.$1}-${RegExp.$2}`] : []
        ];
        
        // Check all possible paths
        const basePath = path.join(process.cwd(), 'client', 'public', 'ranks');
        
        // Try multiple extensions
        const extensions = ['.png', '.jpg', '.jpeg', '.gif'];
        
        // Try all combinations
        for (const name of possibleNames) {
          for (const ext of extensions) {
            const filePath = path.join(basePath, `${name}${ext}`);
            logger.debug(`Trying rank icon path: ${filePath}`);
            
            if (fs.existsSync(filePath)) {
              rankIconAttachment = { attachment: filePath, name: 'rank.png' };
              logger.info(`Found rank icon at: ${filePath}`);
              break;
            }
          }
          if (rankIconAttachment) break;
        }
        
        if (!rankIconAttachment) {
          logger.warn(`Could not find rank icon for rank: ${playerRank.name} (tried multiple variations)`);
        }
      } catch (error) {
        logger.error(`Error finding rank icon: ${error}`);
        // Continue without the rank icon if there's an error
      }
    }

    // Get recent matches for this player
    const matches = await storage.getPlayerMatches(player.id, 5);

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
    logger.error("Error executing profile command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
    });

    // Try to provide a more specific error message
    let errorMessage = "There was an error retrieving the profile information. Please try again later.";
    
    if (error instanceof Error) {
      if (error.message.includes("ENOENT") && error.message.includes("ranks")) {
        errorMessage = "Could not load rank icon images. Profile information is still available.";
      } else if (error.message.includes("getPlayerByDiscordId")) {
        errorMessage = "Could not retrieve player data. Please try again later.";
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
