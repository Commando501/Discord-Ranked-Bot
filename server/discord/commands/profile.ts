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

    // Get recent matches for this player
    const matches = await storage.getPlayerMatches(player.id, 5);

    // Create profile embed
    const embed = new EmbedBuilder()
      .setColor("#5865F2") // Discord blurple
      .setTitle(`${targetUser.username}'s Profile`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: "MMR Rating", value: `${player.mmr}`, inline: true },
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
        historyText += `${resultText} | Match #${match.id} | Team ${match.playerTeamName || "Unknown"} | ${matchDate}${mmrChangeText ? ` | MMR: ${mmrChangeText}` : ""}\n`;
      }

      embed.addFields({ name: "Recent Matches", value: historyText });
    } else {
      embed.addFields({ name: "Recent Matches", value: "No recent matches" });
    }

    embed.setFooter({
      text: `Player since ${new Date(player.createdAt).toLocaleDateString()}`,
    });

    await interaction.editReply({ embeds: [embed] });
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
