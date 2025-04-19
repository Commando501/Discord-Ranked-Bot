import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { QueueService } from "../../bot/services/queueService";
import { MatchService } from "../../bot/services/matchService";
import { PlayerService } from "../../bot/services/playerService";
import { storage } from "../../storage";
import { formatDuration } from "../../bot/utils/timeUtils";
import { logger } from "../../bot/utils/logger";

export const data = new SlashCommandBuilder()
  .setName("list")
  .setDescription("List players in the queue and active matches");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const queueService = new QueueService(storage);
    const matchService = new MatchService(storage);
    const playerService = new PlayerService(storage);

    // Get queue and match data
    const queuePlayers = await queueService.getQueuePlayersWithInfo();
    const activeMatches = await matchService.getActiveMatches();

    // Create queue embed
    const queueEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("Matchmaking Queue")
      .setDescription(`${queuePlayers.length} players in queue`);

    if (queuePlayers.length > 0) {
      const queueList = queuePlayers
        .map((entry, index) => {
          const waitTime = formatDuration(entry.joinedAt);
          return `${index + 1}. ${entry.player.username} (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
        })
        .join("\n");

      queueEmbed.addFields({ name: "Players", value: queueList });
    }
    
    // Check if the user who ran the command is already in queue
    const player = await playerService.getPlayerByDiscordId(interaction.user.id);
    const isInQueue = player ? await queueService.getPlayerQueueEntry(player.id) : null;

    // Create matches embed
    const matchesEmbed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("Active Matches")
      .setDescription(
        activeMatches.length > 0
          ? `${activeMatches.length} active matches`
          : "No active matches",
      );

    // If there are active matches, fetch detailed information for each
    if (activeMatches.length > 0) {
      // Create a separate embed for each match with detailed information
      const matchEmbeds = await Promise.all(
        activeMatches.map(async (match) => {
          try {
            // Get detailed match information including teams
            const matchDetails = await matchService.getMatchDetails(match.id);

            // Calculate match duration
            const matchDuration = formatDuration(match.createdAt);

            // Create embed for this match
            const matchEmbed = new EmbedBuilder()
              .setColor("#3BA55C")
              .setTitle(`Match #${match.id}`)
              .setDescription(
                `Status: ${match.status} | Started: ${matchDuration} ago`,
              )
              .setFooter({
                text: `Use /endmatch ${match.id} Eagle|Cobra to end this match`,
              });

            // Add team information if available
            if (matchDetails?.teams && matchDetails.teams.length > 0) {
              matchDetails.teams.forEach((team) => {
                const teamPlayers = team.players
                  .map((player) => `${player.username} (MMR: ${player.mmr})`)
                  .join("\n");

                matchEmbed.addFields({
                  name: `Team ${team.name} (Avg MMR: ${team.avgMMR})`,
                  value: teamPlayers || "No players",
                  inline: true,
                });
              });
            }

            return matchEmbed;
          } catch (detailError) {
            logger.error(
              `Error fetching details for match ${match.id}:`,
              detailError,
            );
            // Fallback to simple match embed if details can't be fetched
            return new EmbedBuilder()
              .setColor("#ED4245")
              .setTitle(`Match #${match.id}`)
              .setDescription(
                `Status: ${match.status}\nStarted: ${formatDuration(match.createdAt)}\n⚠️ Could not load detailed information`,
              );
          }
        }),
      );

      // Create queue action buttons
      const queueActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('queue_join')
          .setLabel('Join Queue')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!!isInQueue),
        new ButtonBuilder()
          .setCustomId('queue_leave')
          .setLabel('Leave Queue')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!isInQueue)
      );

      // Send queue embed with buttons first, then all match embeds
      await interaction.editReply({
        embeds: [queueEmbed, ...matchEmbeds],
        components: [queueActionRow],
      });
    } else {
      // Create queue action buttons
      const queueActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('queue_join')
          .setLabel('Join Queue')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!!isInQueue),
        new ButtonBuilder()
          .setCustomId('queue_leave')
          .setLabel('Leave Queue')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!isInQueue)
      );

      // If no matches, just send the queue embed, empty matches embed, and buttons
      await interaction.editReply({ 
        embeds: [queueEmbed, matchesEmbed],
        components: [queueActionRow],
      });
    }
  } catch (error) {
    logger.error(`Error in list command:`, error);
    await interaction.editReply(
      "An error occurred while fetching the queue and match information.",
    );
  }
}
