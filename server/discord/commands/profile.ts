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
      const rankName = playerRank.name.replace(/\s+/g, '');
      const iconPath = path.join(process.cwd(), 'client', 'public', 'ranks', `${rankName}.png`);
      
      // Try different variations if the exact match is not found
      const iconPaths = [
        iconPath,
        path.join(process.cwd(), 'client', 'public', 'ranks', `${rankName.toLowerCase()}.png`),
        // Try with first letter capitalized
        path.join(process.cwd(), 'client', 'public', 'ranks', `${rankName.charAt(0).toUpperCase() + rankName.slice(1).toLowerCase()}.png`)
      ];
      
      for (const path of iconPaths) {
        if (fs.existsSync(path)) {
          rankIconAttachment = { attachment: path, name: 'rank.png' };
          break;
        }
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
      error,
      userId: interaction.user.id,
    });

    const errorEmbed = new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle("Error")
      .setDescription(
        "There was an error retrieving the profile information. Please try again later.",
      );

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
