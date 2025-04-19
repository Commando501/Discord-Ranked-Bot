import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
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
      // Get rank tiers
      const rankTiers = await storage.getRankTiers();

      // Build queue list with rank info
      const queueListPromises = queuePlayers.map(async (entry, index) => {
        const waitTime = formatDuration(entry.joinedAt);
        // Get player rank
        const playerRank = await storage.getPlayerRank(
          entry.player.mmr,
          rankTiers,
        );

        // Create emoji reference
        let rankEmoji = "";

        // Map rank names to emoji IDs
        const rankEmojiMap: Record<string, string> = {
          "Iron 1": "<:Iron1:1363039589538861057>",
          "Iron 2": "<:Iron2:1363039575013851156>",
          "Bronze 3": "<:Bronze3:1363039607536615454>",
          "Bronze 2": "<:Bronze2:1363039615044288522>",
          "Bronze 1": "<:Bronze1:1363039622195839107>",
          "Silver 3": "<:Silver3:1363039663228719124>",
          "Silver 2": "<:Silver2:1363039669922824344>",
          "Silver 1": "<:Silver1:1363039677724233849>",
          "Gold 3": "<:Gold3:1363042192196632666>",
          "Gold 2": "<:Gold2:1363042203340902530>",
          "Gold 1": "<:Gold1:1363042214715986041>",
          "Platinum 3": "<:Platinum3:1363039687358287872>",
          "Platinum 2": "<:Platinum2:1363039694878806186>",
          "Platinum 1": "<:Platinum1:1363039703909138502>",
          "Diamond 3": "<:Diamond3:1363039725136379955>",
          "Diamond 2": "<:Diamond2:1363039734028435618>",
          "Diamond 1": "<:Diamond1:1363039742249402428>",
          "Masters 3": "<:Masters3:1363039762142986350>",
          "Masters 2": "<:Masters2:1363039770342723604>",
          "Masters 1": "<:Masters1:1363039778580205619>",
          Challenger: "<:Challenger:1363039996868558879>",
        };

        // Get the emoji for this rank if it exists
        if (rankEmojiMap[playerRank.name]) {
          rankEmoji = rankEmojiMap[playerRank.name] + " ";
        }

        return `${index + 1}. ${rankEmoji}${entry.player.username} [${playerRank.name}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
      });

      const queueList = (await Promise.all(queueListPromises)).join("\n");
      queueEmbed.addFields({ name: "Players", value: queueList });
    }

    // Create matches embed
    const matchesEmbed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("Active Matches")
      .setDescription(
        activeMatches.length > 0
          ? `${activeMatches.length} active matches`
          : "No active matches",
      );

    // Create button row with Queue and Leave buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("join_queue")
        .setLabel("Join Queue")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId("leave_queue")
        .setLabel("Leave Queue")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌"),
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

      // Send queue embed first, then all match embeds with buttons
      const reply = await interaction.editReply({
        embeds: [queueEmbed, ...matchEmbeds],
        components: [row],
      });

      // Set up collector to handle button interactions
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 600000, // 10 minutes
      });

      collector.on("collect", async (i) => {
        // Defer the ephemeral reply to acknowledge the interaction
        await i.deferReply({ ephemeral: true });

        // Get or create player for the user who clicked the button
        const player = await playerService.getOrCreatePlayer({
          id: i.user.id,
          username: i.user.tag,
          discriminator: "",
          avatar: null,
        });

        if (i.customId === "join_queue") {
          // Check if player is already in queue
          const existingQueueEntry = await queueService.getPlayerQueueEntry(
            player.id,
          );

          if (existingQueueEntry) {
            await i.editReply({
              content: "You are already in the matchmaking queue.",
            });
            return;
          }

          // Add player to queue
          const queueResult = await queueService.addPlayerToQueue(player.id);

          if (!queueResult.success) {
            await i.editReply({
              content: `Failed to join queue: ${queueResult.message}`,
            });
            return;
          }

          // Get updated queue size
          const updatedQueueCount = (await queueService.getAllQueueEntries())
            .length;

          await i.editReply({
            content: `You have been added to the matchmaking queue! Current queue size: ${updatedQueueCount} players.`,
          });

          // Check if we can create a match
          if (i.guild) {
            await queueService.checkAndCreateMatch(i.guild);
          }
        } else if (i.customId === "leave_queue") {
          // Check if player is in queue
          const queueEntry = await queueService.getPlayerQueueEntry(player.id);

          if (!queueEntry) {
            // Check if player is in an active match
            const isInMatch = await queueService.isPlayerInActiveMatch(
              player.id,
            );

            if (isInMatch) {
              // Find the match the player is in
              const activeMatches = await matchService.getActiveMatches();
              let playerMatch = null;

              // Find which match the player is in
              for (const match of activeMatches) {
                for (const team of match.teams) {
                  const isInTeam = team.players.some((p) => p.id === player.id);
                  if (isInTeam) {
                    playerMatch = match;
                    break;
                  }
                }
                if (playerMatch) break;
              }

              if (playerMatch) {
                // Handle match cancellation with exclusion
                const result =
                  await matchService.handleMatchCancellationWithExclusion(
                    playerMatch.id,
                    player.id,
                  );

                if (result.success) {
                  await i.editReply({
                    content: `You have left match #${playerMatch.id}. The match has been cancelled and other players returned to queue.`,
                  });
                } else {
                  await i.editReply({
                    content: `Failed to leave match: ${result.message}`,
                  });
                }
                return;
              }
            }

            await i.editReply({
              content:
                "You are not currently in the matchmaking queue or an active match.",
            });
            return;
          }

          // Remove player from queue
          await queueService.removePlayerFromQueue(player.id);

          // Get updated queue size
          const updatedQueueCount = (await queueService.getAllQueueEntries())
            .length;

          await i.editReply({
            content: `You have been removed from the matchmaking queue. Current queue size: ${updatedQueueCount} players.`,
          });
        }

        // Update the original embed with fresh data after queue change
        try {
          // Get updated queue and match data
          const queuePlayers = await queueService.getQueuePlayersWithInfo();
          const activeMatches = await matchService.getActiveMatches();

          // Create updated queue embed
          const updatedQueueEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("Matchmaking Queue")
            .setDescription(`${queuePlayers.length} players in queue`);

          if (queuePlayers.length > 0) {
            // Get rank tiers
            const rankTiers = await storage.getRankTiers();

            // Build queue list with rank info
            const queueListPromises = queuePlayers.map(async (entry, index) => {
              const waitTime = formatDuration(entry.joinedAt);
              // Get player rank
              const playerRank = await storage.getPlayerRank(
                entry.player.mmr,
                rankTiers,
              );

              // Create emoji reference
              let rankEmoji = "";

              // Map rank names to emoji IDs
              const rankEmojiMap: Record<string, string> = {
                "Iron 1": "<:Iron1:1363039589538861057>",
                "Iron 2": "<:Iron2:1363039575013851156>",
                "Bronze 3": "<:Bronze3:1363039607536615454>",
                "Bronze 2": "<:Bronze2:1363039615044288522>",
                "Bronze 1": "<:Bronze1:1363039622195839107>",
                "Silver 3": "<:Silver3:1363039663228719124>",
                "Silver 2": "<:Silver2:1363039669922824344>",
                "Silver 1": "<:Silver1:1363039677724233849>",
                "Gold 3": "<:Gold3:1363042192196632666>",
                "Gold 2": "<:Gold2:1363042203340902530>",
                "Gold 1": "<:Gold1:1363042214715986041>",
                "Platinum 3": "<:Platinum3:1363039687358287872>",
                "Platinum 2": "<:Platinum2:1363039694878806186>",
                "Platinum 1": "<:Platinum1:1363039703909138502>",
                "Diamond 3": "<:Diamond3:1363039725136379955>",
                "Diamond 2": "<:Diamond2:1363039734028435618>",
                "Diamond 1": "<:Diamond1:1363039742249402428>",
                "Masters 3": "<:Masters3:1363039762142986350>",
                "Masters 2": "<:Masters2:1363039770342723604>",
                "Masters 1": "<:Masters1:1363039778580205619>",
                Challenger: "<:Challenger:1363039996868558879>",
              };

              // Get the emoji for this rank if it exists
              if (rankEmojiMap[playerRank.name]) {
                rankEmoji = rankEmojiMap[playerRank.name] + " ";
              }

              return `${index + 1}. ${rankEmoji}${entry.player.username} [${playerRank.name}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
            });

            const queueList = (await Promise.all(queueListPromises)).join("\n");
            updatedQueueEmbed.addFields({ name: "Players", value: queueList });
          }

          // If there are active matches, re-create match embeds
          if (activeMatches.length > 0) {
            // Create a separate embed for each match with detailed information
            const updatedMatchEmbeds = await Promise.all(
              activeMatches.map(async (match) => {
                try {
                  // Get detailed match information including teams
                  const matchDetails = await matchService.getMatchDetails(
                    match.id,
                  );

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
                        .map(
                          (player) => `${player.username} (MMR: ${player.mmr})`,
                        )
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

            // Update the original message with fresh embeds
            await interaction.editReply({
              embeds: [updatedQueueEmbed, ...updatedMatchEmbeds],
              components: [row],
            });
          } else {
            // If no matches, just create empty match embed
            const updatedMatchesEmbed = new EmbedBuilder()
              .setColor("#57F287")
              .setTitle("Active Matches")
              .setDescription("No active matches");

            // Update the original message with the refreshed embeds
            await interaction.editReply({
              embeds: [updatedQueueEmbed, updatedMatchesEmbed],
              components: [row],
            });
          }
        } catch (updateError) {
          logger.error(
            `Error updating embed after button click: ${updateError}`,
          );
          // Don't need to notify the user since they got a direct ephemeral response
        }
      });
    } else {
      // If no matches, just send the queue embed and empty matches embed with buttons
      const reply = await interaction.editReply({
        embeds: [queueEmbed, matchesEmbed],
        components: [row],
      });

      // Set up collector to handle button interactions
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 600000, // 10 minutes
      });

      collector.on("collect", async (i) => {
        // Defer the ephemeral reply to acknowledge the interaction
        await i.deferReply({ ephemeral: true });

        // Get or create player for the user who clicked the button
        const player = await playerService.getOrCreatePlayer({
          id: i.user.id,
          username: i.user.tag,
          discriminator: "",
          avatar: null,
        });

        if (i.customId === "join_queue") {
          // Check if player is already in queue
          const existingQueueEntry = await queueService.getPlayerQueueEntry(
            player.id,
          );

          if (existingQueueEntry) {
            await i.editReply({
              content: "You are already in the matchmaking queue.",
            });
            return;
          }

          // Add player to queue
          const queueResult = await queueService.addPlayerToQueue(player.id);

          if (!queueResult.success) {
            await i.editReply({
              content: `Failed to join queue: ${queueResult.message}`,
            });
            return;
          }

          // Get updated queue size
          const updatedQueueCount = (await queueService.getAllQueueEntries())
            .length;

          await i.editReply({
            content: `You have been added to the matchmaking queue! Current queue size: ${updatedQueueCount} players.`,
          });

          // Check if we can create a match
          if (i.guild) {
            await queueService.checkAndCreateMatch(i.guild);
          }
        } else if (i.customId === "leave_queue") {
          // Check if player is in queue
          const queueEntry = await queueService.getPlayerQueueEntry(player.id);

          if (!queueEntry) {
            // Check if player is in an active match
            const isInMatch = await queueService.isPlayerInActiveMatch(
              player.id,
            );

            if (isInMatch) {
              // Find the match the player is in
              const activeMatches = await matchService.getActiveMatches();
              let playerMatch = null;

              // Find which match the player is in
              for (const match of activeMatches) {
                for (const team of match.teams) {
                  const isInTeam = team.players.some((p) => p.id === player.id);
                  if (isInTeam) {
                    playerMatch = match;
                    break;
                  }
                }
                if (playerMatch) break;
              }

              if (playerMatch) {
                // Handle match cancellation with exclusion
                const result =
                  await matchService.handleMatchCancellationWithExclusion(
                    playerMatch.id,
                    player.id,
                  );

                if (result.success) {
                  await i.editReply({
                    content: `You have left match #${playerMatch.id}. The match has been cancelled and other players returned to queue.`,
                  });
                } else {
                  await i.editReply({
                    content: `Failed to leave match: ${result.message}`,
                  });
                }
                return;
              }
            }

            await i.editReply({
              content:
                "You are not currently in the matchmaking queue or an active match.",
            });
            return;
          }

          // Remove player from queue
          await queueService.removePlayerFromQueue(player.id);

          // Get updated queue size
          const updatedQueueCount = (await queueService.getAllQueueEntries())
            .length;

          await i.editReply({
            content: `You have been removed from the matchmaking queue. Current queue size: ${updatedQueueCount} players.`,
          });
        }

        // Update the original embed with fresh data after queue change
        try {
          // Get updated queue and match data
          const queuePlayers = await queueService.getQueuePlayersWithInfo();
          const activeMatches = await matchService.getActiveMatches();

          // Create updated queue embed
          const updatedQueueEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("Matchmaking Queue")
            .setDescription(`${queuePlayers.length} players in queue`);

          if (queuePlayers.length > 0) {
            // Get rank tiers
            const rankTiers = await storage.getRankTiers();

            // Build queue list with rank info
            const queueListPromises = queuePlayers.map(async (entry, index) => {
              const waitTime = formatDuration(entry.joinedAt);
              // Get player rank
              const playerRank = await storage.getPlayerRank(
                entry.player.mmr,
                rankTiers,
              );

              // Create emoji reference
              let rankEmoji = "";

              // Map rank names to emoji IDs
              const rankEmojiMap: Record<string, string> = {
                'Iron 1': '<:Iron1:1363039589538861057>',
                'Iron 2': '<:Iron2:1363039575013851156>',
                'Bronze 3': '<:Bronze3:1363039607536615454>',
                'Bronze 2': '<:Bronze2:1363039615044288522>',
                'Bronze 1': '<:Bronze1:1363039622195839107>',
                'Silver 3': '<:Silver3:1363039663228719124>',
                'Silver 2': '<:Silver2:1363039669922824344>',
                'Silver 1': '<:Silver1:1363039677724233849>',
                'Gold 3': '<:Gold3:1363042192196632666>',
                'Gold 2': '<:Gold2:1363042203340902530>',
                'Gold 1': '<:Gold1:1363042214715986041>',
                'Platinum 3': '<:Platinum3:1363039687358287872>',
                'Platinum 2': '<:Platinum2:1363039694878806186>',
                'Platinum 1': '<:Platinum1:1363039703909138502>',
                'Diamond 3': '<:Diamond3:1363039725136379955>',
                'Diamond 2': '<:Diamond2:1363039734028435618>',
                'Diamond 1': '<:Diamond1:1363039742249402428>',
                'Masters 3': '<:Masters3:1363039762142986350>',
                'Masters 2': '<:Masters2:1363039770342723604>',
                'Masters 1': '<:Masters1:1363039778580205619>',
                'Challenger': '<:Challenger:1363039996868558879>'
              };

              // Get the emoji for this rank if it exists
              if (rankEmojiMap[playerRank.name]) {
                rankEmoji = rankEmojiMap[playerRank.name] + " ";
              }

              return `${index + 1}. ${rankEmoji}${entry.player.username} [${playerRank.name}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
            });

            const queueList = (await Promise.all(queueListPromises)).join("\n");
            updatedQueueEmbed.addFields({ name: "Players", value: queueList });
          }

          // If there are active matches, re-create match embeds
          if (activeMatches.length > 0) {
            // Create a separate embed for each match with detailed information
            const updatedMatchEmbeds = await Promise.all(
              activeMatches.map(async (match) => {
                try {
                  // Get detailed match information including teams
                  const matchDetails = await matchService.getMatchDetails(
                    match.id,
                  );

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
                        .map(
                          (player) => `${player.username} (MMR: ${player.mmr})`,
                        )
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

            // Update the original message with fresh embeds
            await interaction.editReply({
              embeds: [updatedQueueEmbed, ...updatedMatchEmbeds],
              components: [row],
            });
          } else {
            // If no matches, just create empty match embed
            const updatedMatchesEmbed = new EmbedBuilder()
              .setColor("#57F287")
              .setTitle("Active Matches")
              .setDescription("No active matches");

            // Update the original message with the refreshed embeds
            await interaction.editReply({
              embeds: [updatedQueueEmbed, updatedMatchesEmbed],
              components: [row],
            });
          }
        } catch (updateError) {
          logger.error(
            `Error updating embed after button click: ${updateError}`,
          );
          // Don't need to notify the user since they got a direct ephemeral response
        }
      });
    }
  } catch (error) {
    logger.error(`Error in list command:`, error);
    await interaction.editReply(
      "An error occurred while fetching the queue and match information.",
    );
  }
}
