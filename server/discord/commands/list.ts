import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Client,
} from "discord.js";
import fetch from "node-fetch";
import { QueueService } from "../../bot/services/queueService";
import { MatchService } from "../../bot/services/matchService";
import { PlayerService } from "../../bot/services/playerService";
import { storage } from "../../storage";
import { formatDuration } from "../../bot/utils/timeUtils";
import { logger } from "../../bot/utils/logger";

export const data = new SlashCommandBuilder()
  .setName("list")
  .setDescription("List players in the queue and active matches");

async function fetchApplicationEmoji(
  applicationId: string,
  emojiId: string,
  botToken: string,
) {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/applications/<span class="math-inline">\{applicationId\}/emojis/</span>{emojiId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error(`Error fetching application emoji ${emojiId}:`, error);
    return null;
  }
}

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
      let rankTiers = await storage.getRankTiers();

      // Build queue list with rank info
      const queueListPromises = queuePlayers.map(async (entry, index) => {
        const waitTime = formatDuration(entry.joinedAt);
        // Get player rank using the same method as the profile command
        let playerRank = null;

        // First, try to load directly from discordbot-config.json to ensure we get the full set of tiers with subdivisions (Gold 1, Gold 2, Gold 3)
        try {
          // Use dynamic imports for fs and path
          const fs = await import("fs");
          const path = await import("path");
          const configPath = path.join(process.cwd(), "discordbot-config.json");

          if (fs.existsSync(configPath)) {
            const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
            if (
              configData.seasonManagement &&
              configData.seasonManagement.rankTiers &&
              configData.seasonManagement.rankTiers.length > 0
            ) {
              // Replace with config ranks if they exist - this ensures we use the complete set with subdivisions
              rankTiers = configData.seasonManagement.rankTiers;
              logger.info(
                `Using ${rankTiers.length} detailed rank tiers from config file for list command`,
              );
              // Log all tier names for debugging
              logger.info(
                `Available tiers: ${rankTiers.map((t) => t.name).join(", ")}`,
              );
            }
          }
        } catch (configError) {
          logger.error(
            `Error loading detailed rank tiers from config: ${configError}`,
          );
        }

        // COMPLETE ALGORITHM REWRITE for tier determination:
        // Each tier's threshold is the UPPER bound of its range
        // The lower bound is the previous tier's threshold + 1 or 0 for the lowest tier

        // Sort tiers by threshold in ascending order
        const sortedTiers = [...rankTiers].sort(
          (a, b) => a.mmrThreshold - b.mmrThreshold,
        );

        // Print all thresholds for debugging
        const thresholds = sortedTiers
          .map((tier) => `${tier.name}: ${tier.mmrThreshold}`)
          .join(", ");
        logger.info(`All tier thresholds in ascending order: ${thresholds}`);

        // Find the appropriate tier by checking MMR ranges explicitly
        let foundTier = null;

        // For each tier, explicitly define its range and check if player MMR falls within it
        for (let i = 0; i < sortedTiers.length; i++) {
          const currentTier = sortedTiers[i];
          const prevTier = i > 0 ? sortedTiers[i - 1] : null;

          // Upper bound is inclusive (<=), lower bound is previous tier's threshold + 1 or 0
          const upperBound = currentTier.mmrThreshold;
          const lowerBound = prevTier ? prevTier.mmrThreshold + 1 : 0;

          logger.info(
            `Checking tier ${currentTier.name}: Range ${lowerBound} to ${upperBound} against MMR ${entry.player.mmr}`,
          );

          if (
            entry.player.mmr >= lowerBound &&
            entry.player.mmr <= upperBound
          ) {
            foundTier = currentTier;
            logger.info(
              `MATCH FOUND: Player MMR ${entry.player.mmr} belongs to ${foundTier.name}`,
            );
            logger.info(`This tier's range is ${lowerBound} to ${upperBound}`);
            break;
          }
        }

        // If tier found, use it
        if (foundTier) {
          playerRank = foundTier;
          logger.info(
            `FINAL: Selected rank "${playerRank.name}" for player with MMR ${entry.player.mmr}.`,
          );
        }

        // If no tier found, use the lowest one
        if (!playerRank && sortedTiers.length > 0) {
          playerRank = sortedTiers[0];
        }

        // Fallback to getPlayerRank if needed
        if (!playerRank) {
          const { getPlayerRank } = await import("@shared/rankSystem");
          playerRank = await getPlayerRank(entry.player.mmr, rankTiers);
        }

        // Create emoji reference
        let rankEmoji = "";

        // Map rank names to emoji IDs
        const rankEmojiMap: Record<string, string> = {
          "Iron 1": "1363039589538861057",
          "Iron 2": "1363039575013851156",
          "Bronze 3": "1363039607536615454",
          "Bronze 2": "1363039615044288522",
          "Bronze 1": "1363039622195839107",
          "Silver 3": "1363039663228719124",
          "Silver 2": "1363039669922824344",
          "Silver 1": "1363039677724233849",
          "Gold 3": "1363042192196632666",
          "Gold 2": "1363042203340902530",
          "Gold 1": "1363042214715986041",
          "Platinum 3": "1363039687358287872",
          "Platinum 2": "1363039694878806186",
          "Platinum 1": "1363039703909138502",
          "Diamond 3": "1363039725136379955",
          "Diamond 2": "1363039734028435618",
          "Diamond 1": "1363039742249402428",
          "Masters 3": "1363039762142986350",
          "Masters 2": "1363039770342723604",
          "Masters 1": "1363039778580205619",
          Challenger: "1363039996868558879",
        };

        // Get the emoji for this rank if it exists
        if (playerRank && rankEmojiMap[playerRank.name]) {
          const emojiId = rankEmojiMap[playerRank.name];
          let emoji: any = null;

          // Try fetching from cache first (discord.js)
          emoji = interaction.client.emojis.cache.get(emojiId);

          if (!emoji) {
            // If not in cache, fetch from Discord API
            emoji = await fetchApplicationEmoji(
              interaction.client.applicationId!, // application ID
              emojiId,
              interaction.client.token!, // bot token
            );
          }

          if (emoji) {
            rankEmoji = ` <:<span class="math-inline">\{emoji\.name\}\:</span>{emoji.id}>`; // Format for display
          } else {
            logger.warn(`Emoji with ID ${emojiId} not found.`);
            rankedEmoji = "";
          }
        }

        return `${index + 1}. ${entry.player.username} [${playerRank.name}${rankEmoji}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
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
            let rankTiers = await storage.getRankTiers();

            // First, try to load directly from discordbot-config.json to ensure we get the full set of tiers with subdivisions
            try {
              // Use dynamic imports for fs and path
              const fs = await import("fs");
              const path = await import("path");
              const configPath = path.join(
                process.cwd(),
                "discordbot-config.json",
              );

              if (fs.existsSync(configPath)) {
                const configData = JSON.parse(
                  fs.readFileSync(configPath, "utf8"),
                );
                if (
                  configData.seasonManagement &&
                  configData.seasonManagement.rankTiers &&
                  configData.seasonManagement.rankTiers.length > 0
                ) {
                  // Replace with config ranks if they exist - this ensures we use the complete set with subdivisions
                  rankTiers = configData.seasonManagement.rankTiers;
                  logger.info(
                    `Using ${rankTiers.length} detailed rank tiers from config file for list update`,
                  );
                  // Log all tier names for debugging
                  logger.info(
                    `Available tiers for update: ${rankTiers.map((t) => t.name).join(", ")}`,
                  );
                }
              }
            } catch (configError) {
              logger.error(
                `Error loading detailed rank tiers from config: ${configError}`,
              );
            }

            // Build queue list with rank info
            const queueListPromises = queuePlayers.map(async (entry, index) => {
              const waitTime = formatDuration(entry.joinedAt);
              // Get player rank using the same method as the profile command
              let playerRank = null;

              // COMPLETE ALGORITHM REWRITE for tier determination:
              // Each tier's threshold is the UPPER bound of its range
              // The lower bound is the previous tier's threshold + 1 or 0 for the lowest tier

              // Sort tiers by threshold in ascending order
              const sortedTiers = [...rankTiers].sort(
                (a, b) => a.mmrThreshold - b.mmrThreshold,
              );

              // Print all thresholds for debugging
              const thresholds = sortedTiers
                .map((tier) => `${tier.name}: ${tier.mmrThreshold}`)
                .join(", ");
              logger.info(
                `All tier thresholds for update in ascending order: ${thresholds}`,
              );

              // Find the appropriate tier by checking MMR ranges explicitly
              let foundTier = null;

              // For each tier, explicitly define its range and check if player MMR falls within it
              for (let i = 0; i < sortedTiers.length; i++) {
                const currentTier = sortedTiers[i];
                const prevTier = i > 0 ? sortedTiers[i - 1] : null;

                // Upper bound is inclusive (<=), lower bound is previous tier's threshold + 1 or 0
                const upperBound = currentTier.mmrThreshold;
                const lowerBound = prevTier ? prevTier.mmrThreshold + 1 : 0;

                logger.info(
                  `Checking tier ${currentTier.name}: Range ${lowerBound} to ${upperBound} against MMR ${entry.player.mmr}`,
                );

                if (
                  entry.player.mmr >= lowerBound &&
                  entry.player.mmr <= upperBound
                ) {
                  foundTier = currentTier;
                  logger.info(
                    `MATCH FOUND: Player MMR ${entry.player.mmr} belongs to ${foundTier.name}`,
                  );
                  logger.info(
                    `This tier's range is ${lowerBound} to ${upperBound}`,
                  );
                  break;
                }
              }

              // If tier found, use it
              if (foundTier) {
                playerRank = foundTier;
                logger.info(
                  `FINAL UPDATE: Selected rank "${playerRank.name}" for player with MMR ${entry.player.mmr}.`,
                );
              }

              // If no tier found, use the lowest one
              if (!playerRank && sortedTiers.length > 0) {
                playerRank = sortedTiers[0];
              }

              // Fallback to getPlayerRank if needed
              if (!playerRank) {
                const { getPlayerRank } = await import("@shared/rankSystem");
                playerRank = await getPlayerRank(entry.player.mmr, rankTiers);
              }

              // Create emoji reference
              let rankEmoji = "";

              // Map rank names to emoji IDs
              const rankEmojiMap: Record<string, string> = {
                "Iron 1": "1363039589538861057",
                "Iron 2": "1363039575013851156",
                "Bronze 3": "1363039607536615454",
                "Bronze 2": "1363039615044288522",
                "Bronze 1": "1363039622195839107",
                "Silver 3": "1363039663228719124",
                "Silver 2": "1363039669922824344",
                "Silver 1": "1363039677724233849",
                "Gold 3": "1363042192196632666",
                "Gold 2": "1363042203340902530",
                "Gold 1": "1363042214715986041",
                "Platinum 3": "1363039687358287872",
                "Platinum 2": "1363039694878806186",
                "Platinum 1": "1363039703909138502",
                "Diamond 3": "1363039725136379955",
                "Diamond 2": "1363039734028435618",
                "Diamond 1": "1363039742249402428",
                "Masters 3": "1363039762142986350",
                "Masters 2": "1363039770342723604",
                "Masters 1": "1363039778580205619",
                Challenger: "1363039996868558879",
              };

              // Get the emoji for this rank if it exists
              if (playerRank && rankEmojiMap[playerRank.name]) {
                const emojiId = rankEmojiMap[playerRank.name];
                let emoji: any = null;

                // Try fetching from cache first (discord.js)
                emoji = interaction.client.emojis.cache.get(emojiId);

                if (!emoji) {
                  // If not in cache, fetch from Discord API
                  emoji = await fetchApplicationEmoji(
                    interaction.client.applicationId!, // application ID
                    emojiId,
                    interaction.client.token!, // bot token
                  );
                }

                if (emoji) {
                  rankEmoji = ` <:<span class="math-inline">\{emoji\.name\}\:</span>{emoji.id}>`; // Format for display
                } else {
                  logger.warn(`Emoji with ID ${emojiId} not found.`);
                  rankedEmoji = "";
                }
              }

              return `${index + 1}. ${entry.player.username} [${playerRank.name}${rankEmoji}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
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
            let rankTiers = await storage.getRankTiers();

            // First, try to load directly from discordbot-config.json to ensure we get the full set of tiers with subdivisions
            try {
              // Use dynamic imports for fs and path
              const fs = await import("fs");
              const path = await import("path");
              const configPath = path.join(
                process.cwd(),
                "discordbot-config.json",
              );

              if (fs.existsSync(configPath)) {
                const configData = JSON.parse(
                  fs.readFileSync(configPath, "utf8"),
                );
                if (
                  configData.seasonManagement &&
                  configData.seasonManagement.rankTiers &&
                  configData.seasonManagement.rankTiers.length > 0
                ) {
                  // Replace with config ranks if they exist - this ensures we use the complete set with subdivisions
                  rankTiers = configData.seasonManagement.rankTiers;
                  logger.info(
                    `Using ${rankTiers.length} detailed rank tiers from config file for list update`,
                  );
                  // Log all tier names for debugging
                  logger.info(
                    `Available tiers for update: ${rankTiers.map((t) => t.name).join(", ")}`,
                  );
                }
              }
            } catch (configError) {
              logger.error(
                `Error loading detailed rank tiers from config: ${configError}`,
              );
            }

            // Build queue list with rank info
            const queueListPromises = queuePlayers.map(async (entry, index) => {
              const waitTime = formatDuration(entry.joinedAt);
              // Get player rank using the same method as the profile command
              let playerRank = null;

              // COMPLETE ALGORITHM REWRITE for tier determination:
              // Each tier's threshold is the UPPER bound of its range
              // The lower bound is the previous tier's threshold + 1 or 0 for the lowest tier

              // Sort tiers by threshold in ascending order
              const sortedTiers = [...rankTiers].sort(
                (a, b) => a.mmrThreshold - b.mmrThreshold,
              );

              // Print all thresholds for debugging
              const thresholds = sortedTiers
                .map((tier) => `${tier.name}: ${tier.mmrThreshold}`)
                .join(", ");
              logger.info(
                `All tier thresholds for update in ascending order: ${thresholds}`,
              );

              // Find the appropriate tier by checking MMR ranges explicitly
              let foundTier = null;

              // For each tier, explicitly define its range and check if player MMR falls within it
              for (let i = 0; i < sortedTiers.length; i++) {
                const currentTier = sortedTiers[i];
                const prevTier = i > 0 ? sortedTiers[i - 1] : null;

                // Upper bound is inclusive (<=), lower bound is previous tier's threshold + 1 or 0
                const upperBound = currentTier.mmrThreshold;
                const lowerBound = prevTier ? prevTier.mmrThreshold + 1 : 0;

                logger.info(
                  `Checking tier ${currentTier.name}: Range ${lowerBound} to ${upperBound} against MMR ${entry.player.mmr}`,
                );

                if (
                  entry.player.mmr >= lowerBound &&
                  entry.player.mmr <= upperBound
                ) {
                  foundTier = currentTier;
                  logger.info(
                    `MATCH FOUND: Player MMR ${entry.player.mmr} belongs to ${foundTier.name}`,
                  );
                  logger.info(
                    `This tier's range is ${lowerBound} to ${upperBound}`,
                  );
                  break;
                }
              }

              // If tier found, use it
              if (foundTier) {
                playerRank = foundTier;
                logger.info(
                  `FINAL UPDATE: Selected rank "${playerRank.name}" for player with MMR ${entry.player.mmr}.`,
                );
              }

              // If no tier found, use the lowest one
              if (!playerRank && sortedTiers.length > 0) {
                playerRank = sortedTiers[0];
              }

              // Fallback to getPlayerRank if needed
              if (!playerRank) {
                const { getPlayerRank } = await import("@shared/rankSystem");
                playerRank = await getPlayerRank(entry.player.mmr, rankTiers);
              }

              // Create emoji reference
              let rankEmoji = "";

              // Map rank names to emoji IDs
              const rankEmojiMap: Record<string, string> = {
                "Iron 1": "1363039589538861057",
                "Iron 2": "1363039575013851156",
                "Bronze 3": "1363039607536615454",
                "Bronze 2": "1363039615044288522",
                "Bronze 1": "1363039622195839107",
                "Silver 3": "1363039663228719124",
                "Silver 2": "1363039669922824344",
                "Silver 1": "1363039677724233849",
                "Gold 3": "1363042192196632666",
                "Gold 2": "1363042203340902530",
                "Gold 1": "1363042214715986041",
                "Platinum 3": "1363039687358287872",
                "Platinum 2": "1363039694878806186",
                "Platinum 1": "1363039703909138502",
                "Diamond 3": "1363039725136379955",
                "Diamond 2": "1363039734028435618",
                "Diamond 1": "1363039742249402428",
                "Masters 3": "1363039762142986350",
                "Masters 2": "1363039770342723604",
                "Masters 1": "1363039778580205619",
                Challenger: "1363039996868558879",
              };

              // Get the emoji for this rank if it exists
              if (playerRank && rankEmojiMap[playerRank.name]) {
                const emojiId = rankEmojiMap[playerRank.name];
                let emoji: any = null;

                // Try fetching from cache first (discord.js)
                emoji = interaction.client.emojis.cache.get(emojiId);

                if (!emoji) {
                  // If not in cache, fetch from Discord API
                  emoji = await fetchApplicationEmoji(
                    interaction.client.applicationId!, // application ID
                    emojiId,
                    interaction.client.token!, // bot token
                  );
                }

                if (emoji) {
                  rankEmoji = ` <:<span class="math-inline">\{emoji\.name\}\:</span>{emoji.id}>`; // Format for display
                } else {
                  logger.warn(`Emoji with ID ${emojiId} not found.`);
                  rankedEmoji = "";
                }
              }

              return `${index + 1}. ${entry.player.username} [${playerRank.name}${rankEmoji}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
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
