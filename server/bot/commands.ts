import {
  Client,
  Collection,
  SlashCommandBuilder,
  REST,
  Routes,
  CommandInteraction,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { config } from "./config";
import { logger } from "./utils/logger";
import { storage } from "../storage";
import { QueueService } from "./services/queueService";
import { PlayerService } from "./services/playerService";
import { MatchService } from "./services/matchService";
import { formatDuration } from "./utils/helpers";

const queueService = new QueueService(storage);
const playerService = new PlayerService(storage);
const matchService = new MatchService(storage);

// Command definitions
export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName("queue")
      .setDescription("Join the matchmaking queue"),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });

      try {
        const player = await playerService.getOrCreatePlayer({
          id: interaction.user.id,
          username: interaction.user.username,
          discriminator: interaction.user.discriminator,
          avatar: interaction.user.avatar,
        });

        const isAlreadyQueued = await queueService.isPlayerInQueue(player.id);
        if (isAlreadyQueued) {
          return interaction.followUp({
            content: "❌ You are already in the queue.",
            ephemeral: true,
          });
        }

        const queueResult = await queueService.addPlayerToQueue(player.id);

        if (!queueResult.success) {
          return interaction.followUp({
            content: `❌ ${queueResult.message}`,
            ephemeral: true,
          });
        }

        const queueCount = await queueService.getQueueSize();
        const requiredPlayers = config.REQUIRED_PLAYERS_PER_MATCH;

        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("Joined Queue")
          .setDescription(`You have been added to the matchmaking queue.`)
          .addFields(
            {
              name: "Queue Status",
              value: `${queueCount}/${requiredPlayers} players`,
            },
            { name: "Your MMR", value: player.mmr.toString() },
          )
          .setFooter({ text: "Use /leave to leave the queue" });

        await interaction.followUp({
          embeds: [embed],
          ephemeral: true,
        });

        // Check if we can create a match
        if (queueCount >= requiredPlayers) {
          const message = await interaction.channel?.send({
            content: `⚠️ Queue has ${queueCount}/${requiredPlayers} players - checking for match creation...`,
          });

          const matchCreated = await queueService.checkAndCreateMatch(
            interaction.guild!,
          );

          if (matchCreated && message) {
            setTimeout(() => message.delete().catch(), 5000);
          }
        }
      } catch (error) {
        logger.error(`Error in queue command: ${error}`);
        await interaction.followUp({
          content: "Failed to join the queue. Please try again later.",
          ephemeral: true,
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("leave")
      .setDescription("Leave the matchmaking queue"),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });

      try {
        const player = await playerService.getPlayerByDiscordId(
          interaction.user.id,
        );

        if (!player) {
          return interaction.followUp({
            content: "❌ You are not registered in our system.",
            ephemeral: true,
          });
        }

        const removed = await queueService.removePlayerFromQueue(player.id);

        if (!removed) {
          return interaction.followUp({
            content: "❌ You are not in the queue.",
            ephemeral: true,
          });
        }

        await interaction.followUp({
          content: "✅ You have been removed from the queue.",
          ephemeral: true,
        });
      } catch (error) {
        logger.error(`Error in leave command: ${error}`);
        await interaction.followUp({
          content: "Failed to leave the queue. Please try again later.",
          ephemeral: true,
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("list")
      .setDescription("List all players currently in the queue"),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        const queuePlayers = await queueService.getQueuePlayersWithInfo();

        if (queuePlayers.length === 0) {
          return interaction.followUp("The queue is currently empty.");
        }

        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("Current Queue")
          .setDescription(
            `${queuePlayers.length}/${config.REQUIRED_PLAYERS_PER_MATCH} players in queue`,
          )
          .setTimestamp();

        queuePlayers.forEach((entry, index) => {
          const waitTime = formatDuration(
            new Date().getTime() - entry.joinedAt.getTime(),
          );
          embed.addFields({
            name: `${index + 1}. ${entry.player.username}`,
            value: `MMR: ${entry.player.mmr} | Waiting: ${waitTime}`,
            inline: false,
          });
        });

        await interaction.followUp({ embeds: [embed] });
      } catch (error) {
        logger.error(`Error in list command: ${error}`);
        await interaction.followUp(
          "Failed to retrieve the queue. Please try again later.",
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("profile")
      .setDescription("View player statistics")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to view profile for")
          .setRequired(false),
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        const targetUser =
          interaction.options.getUser("user") || interaction.user;

        const player = await playerService.getPlayerByDiscordId(targetUser.id);

        if (!player) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? "You have not played any matches yet."
              : `${targetUser.username} has not played any matches yet.`,
          );
        }

        const winRate =
          player.wins + player.losses > 0
            ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
            : "0.0";

        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle(`${player.username}'s Profile`)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: "MMR", value: player.mmr.toString(), inline: true },
            { name: "Wins", value: player.wins.toString(), inline: true },
            { name: "Losses", value: player.losses.toString(), inline: true },
            { name: "Win Rate", value: `${winRate}%`, inline: true },
            {
              name: "Current Streak",
              value:
                player.winStreak > 0
                  ? `🔥 ${player.winStreak} wins`
                  : player.lossStreak > 0
                    ? `❄️ ${player.lossStreak} losses`
                    : "No streak",
              inline: true,
            },
          )
          .setTimestamp();

        await interaction.followUp({ embeds: [embed] });
      } catch (error) {
        logger.error(`Error in profile command: ${error}`);
        await interaction.followUp(
          "Failed to retrieve player profile. Please try again later.",
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("history")
      .setDescription("View match history")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to view match history for")
          .setRequired(false),
      )
      .addIntegerOption((option) =>
        option
          .setName("count")
          .setDescription("Number of matches to show")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10),
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        const targetUser =
          interaction.options.getUser("user") || interaction.user;
        const count = interaction.options.getInteger("count") || 5;

        const player = await playerService.getPlayerByDiscordId(targetUser.id);

        if (!player) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? "You have not played any matches yet."
              : `${targetUser.username} has not played any matches yet.`,
          );
        }

        const matches = await storage.getPlayerMatches(player.id, count);

        if (matches.length === 0) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? "You have not played any matches yet."
              : `${targetUser.username} has not played any matches yet.`,
          );
        }

        // Create match embeds with detailed information
        let currentPage = 0;
        const matchEmbeds: EmbedBuilder[] = [];

        // Process each match to create detailed embeds
        for (const match of matches) {
          try {
            // Get detailed match information
            const matchDetails = await storage.getMatch(match.id);
            const matchTeams = await storage.getMatchTeams(match.id);

            if (!matchDetails || !matchTeams || matchTeams.length === 0) {
              continue;
            }

            // Find player's team
            const playerTeam = matchTeams.find(t => 
              t.players.some(p => p.id === player.id)
            );

            if (!playerTeam) continue;

            // Find opponent team
            const opponentTeam = matchTeams.find(t => t.id !== playerTeam.id);

            // Determine if player won
            const isWinner = matchDetails.status === "COMPLETED" && 
                              matchDetails.winningTeamId === playerTeam.id;

            // Format dates and calculate duration
            const startDate = new Date(matchDetails.createdAt);
            const endDate = matchDetails.finishedAt ? new Date(matchDetails.finishedAt) : null;

            let matchDuration = "In progress";
            if (endDate) {
              const durationMs = endDate.getTime() - startDate.getTime();
              const minutes = Math.floor(durationMs / 60000);
              const seconds = Math.floor((durationMs % 60000) / 1000);
              const hours = Math.floor(minutes / 60);

              if (hours > 0) {
                matchDuration = `${hours}h ${minutes % 60}m ${seconds}s`;
              } else if (minutes > 0) {
                matchDuration = `${minutes}m ${seconds}s`;
              } else {
                matchDuration = `${seconds}s`;
              }
            }

            // Create embed for this match
            const embed = new EmbedBuilder()
              .setColor(isWinner ? "#3BA55C" : matchDetails.status === "COMPLETED" ? "#ED4245" : "#5865F2")
              .setTitle(`Match #${match.id}`)
              .setDescription(`
Status: ${matchDetails.status}
Started: ${startDate.toLocaleString()}${endDate ? `\nEnded: ${endDate.toLocaleString()}` : ''}
Duration: ${matchDuration}
${matchDetails.map ? `Map: ${matchDetails.map}` : ''}
${matchDetails.server ? `Server: ${matchDetails.server}` : ''}
              `)
              .setFooter({
                text: `Page ${matchEmbeds.length + 1}/${matches.length} | ${player.username}'s Match History`,
              })
              .setTimestamp();

            // Add team information
            matchTeams.forEach((team) => {
              // Format all players in the team with their MMR and changes
              const teamPlayers = team.players.map((p) => {
                // Find if player has MMR change recorded
                const mmrChange = p.mmrChange || 0;
                const mmrChangeText = mmrChange > 0 ? `+${mmrChange}` : mmrChange < 0 ? `${mmrChange}` : "+0";

                // Highlight if this is the current player
                const isCurrentPlayer = p.id === player.id;
                return `${isCurrentPlayer ? '**' : ''}${p.username} (MMR: ${p.mmr}${matchDetails.status === "COMPLETED" ? ` ${mmrChangeText}` : ''})${isCurrentPlayer ? '**' : ''}`;
              }).join("\n");

              // Add field for team highlighting winner
              const isWinningTeam = matchDetails.status === "COMPLETED" && matchDetails.winningTeamId === team.id;
              const teamSymbol = isWinningTeam ? "🏆 " : "";

              embed.addFields({
                name: `${teamSymbol}Team ${team.name} (Avg MMR: ${team.avgMMR})`,
                value: teamPlayers || "No players",
                inline: true,
              });
            });

            matchEmbeds.push(embed);
          } catch (error) {
            logger.error(`Error creating embed for match ${match.id}: ${error}`);
          }
        }

        // If no valid embeds were created
        if (matchEmbeds.length === 0) {
          return interaction.followUp({
            content: "Could not retrieve detailed match history information.",
          });
        }

        // Create navigation buttons
        const prevButton = new ButtonBuilder()
          .setCustomId('history_prev')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const nextButton = new ButtonBuilder()
          .setCustomId('history_next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(matchEmbeds.length <= 1);

        const pageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

        // Send initial message with the first embed and buttons
        const message = await interaction.followUp({
          embeds: [matchEmbeds[0]],
          components: matchEmbeds.length > 1 ? [pageRow] : []
        });

        // Set up collector for button interactions
        if (matchEmbeds.length > 1) {
          const collector = message.createMessageComponentCollector({
            time: 300000, // 5 minutes timeout
          });

          collector.on('collect', async (i) => {
            // Verify that the user who clicked is the user who ran the command
            if (i.user.id !== interaction.user.id) {
              await i.reply({ 
                content: "These buttons are not for you.", 
                ephemeral: true 
              });
              return;
            }

            await i.deferUpdate();

            // Handle pagination
            if (i.customId === 'history_next') {
              currentPage = Math.min(currentPage + 1, matchEmbeds.length - 1);
            } else if (i.customId === 'history_prev') {
              currentPage = Math.max(currentPage - 1, 0);
            }

            // Update button states
            prevButton.setDisabled(currentPage === 0);
            nextButton.setDisabled(currentPage === matchEmbeds.length - 1);

            // Update message with new embed and buttons
            await i.editReply({
              embeds: [matchEmbeds[currentPage]],
              components: [new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton)]
            });
          });

          collector.on('end', async () => {
            // Remove buttons when collector expires
            try {
              await message.edit({
                embeds: [matchEmbeds[currentPage]],
                components: []
              });
            } catch (error) {
              logger.error(`Error removing buttons after collector end: ${error}`);
            }
          });
        }
      } catch (error) {
        logger.error(`Error in history command: ${error}`);
        await interaction.followUp(
          "Failed to retrieve match history. Please try again later.",
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("streak")
      .setDescription("Display your current win/loss streak")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to view streak for")
          .setRequired(false),
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        const targetUser =
          interaction.options.getUser("user") || interaction.user;

        const player = await playerService.getPlayerByDiscordId(targetUser.id);

        if (!player) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? "You have not played any matches yet."
              : `${targetUser.username} has not played any matches yet.`,
          );
        }

        let streakType = "No streak";
        let streakValue = 0;
        let streakEmoji = "😐";
        let color = "#5865F2";

        if (player.winStreak > 0) {
          streakType = "Win Streak";
          streakValue = player.winStreak;
          streakEmoji = "🔥";
          color = "#3BA55C";
        } else if (player.lossStreak > 0) {
          streakType = "Loss Streak";
          streakValue = player.lossStreak;
          streakEmoji = "❄️";
          color = "#ED4245";
        }

        const embed = new EmbedBuilder()
          .setColor(color as any)
          .setTitle(`${player.username}'s Current Streak`)
          .setDescription(`${streakEmoji} **${streakType}**: ${streakValue}`)
          .addFields(
            { name: "Total Wins", value: player.wins.toString(), inline: true },
            {
              name: "Total Losses",
              value: player.losses.toString(),
              inline: true,
            },
            {
              name: "Win Rate",
              value:
                player.wins + player.losses > 0
                  ? `${((player.wins / (player.wins + player.losses)) * 100).toFixed(1)}%`
                  : "0.0%",
              inline: true,
            },
          )
          .setTimestamp();

        await interaction.followUp({ embeds: [embed] });
      } catch (error) {
        logger.error(`Error in streak command: ${error}`);
        await interaction.followUp(
          "Failed to retrieve streak information. Please try again later.",
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("votekick")
      .setDescription("Vote to kick a player from a match")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("The player to kick")
          .setRequired(true),
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        const targetUser = interaction.options.getUser("target");

        if (!targetUser) {
          return interaction.followUp("Please specify a valid user to kick.");
        }

        if (targetUser.id === interaction.user.id) {
          return interaction.followUp(
            "You cannot vote to kick yourself. Use /leave to leave the queue.",
          );
        }

        // Check if both players are in a match
        const initiator = await playerService.getPlayerByDiscordId(
          interaction.user.id,
        );
        const target = await playerService.getPlayerByDiscordId(targetUser.id);

        if (!initiator || !target) {
          return interaction.followUp(
            "One or both players are not registered in our system.",
          );
        }

        const result = await matchService.initiateVoteKick(
          initiator.id,
          target.id,
          interaction,
        );

        if (result.success) {
          await interaction.followUp(result.message);
        } else {
          await interaction.followUp(`❌ ${result.message}`);
        }
      } catch (error) {
        logger.error(`Error in votekick command: ${error}`);
        await interaction.followUp(
          "Failed to initiate vote kick. Please try again later.",
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("forcematch")
      .setDescription("Admin: Force create a match with specified players")
      .addUserOption((option) =>
        option.setName("player1").setDescription("Player 1").setRequired(true),
      )
      .addUserOption((option) =>
        option.setName("player2").setDescription("Player 2").setRequired(true),
      )
      .addUserOption((option) =>
        option.setName("player3").setDescription("Player 3").setRequired(false),
      )
      .addUserOption((option) =>
        option.setName("player4").setDescription("Player 4").setRequired(false),
      )
      .addUserOption((option) =>
        option.setName("player5").setDescription("Player 5").setRequired(false),
      )
      .addUserOption((option) =>
        option.setName("player6").setDescription("Player 6").setRequired(false),
      )
      .addUserOption((option) =>
        option.setName("player7").setDescription("Player 7").setRequired(false),
      )
      .addUserOption((option) =>
        option.setName("player8").setDescription("Player 8").setRequired(false),
      )
      .addUserOption((option) =>
        option.setName("player9").setDescription("Player 9").setRequired(false),
      )
      .addUserOption((option) =>
        option
          .setName("player10")
          .setDescription("Player 10")
          .setRequired(false),
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has("Administrator")) {
          return interaction.followUp(
            "❌ You do not have permission to use this command.",
          );
        }

        const playerOptions = [
          "player1",
          "player2",
          "player3",
          "player4",
          "player5",
          "player6",
          "player7",
          "player8",
          "player9",
          "player10",
        ];

        const playerUsers = playerOptions
          .map((option) => interaction.options.getUser(option))
          .filter(Boolean);

        if (playerUsers.length < 2) {
          return interaction.followUp(
            "❌ You need to specify at least 2 players.",
          );
        }

        // Get or create players
        const players = [];
        for (const user of playerUsers) {
          if (!user) continue;

          const player = await playerService.getOrCreatePlayer({
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
          });

          players.push(player);
        }

        // Force create match
        const result = await matchService.createMatchWithPlayers(
          players.map((p) => p.id),
          interaction.guild!,
        );

        if (result.success) {
          await interaction.followUp(`✅ Match created! ${result.message}`);
        } else {
          await interaction.followUp(
            `❌ Failed to create match: ${result.message}`,
          );
        }
      } catch (error) {
        logger.error(`Error in forcematch command: ${error}`);
        await interaction.followUp(
          "Failed to create match. Please try again later.",
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("endmatch")
      .setDescription("Admin: End a match and record results")
      .addIntegerOption((option) =>
        option
          .setName("match_id")
          .setDescription("The ID of the match to end")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("winning_team")
          .setDescription("The name of the winning team (Eagle or Cobra)")
          .setRequired(true),
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has("Administrator")) {
          return interaction.followUp(
            "❌ You do not have permission to use this command.",
          );
        }

        const matchId = interaction.options.getInteger("match_id");
        const winningTeamName = interaction.options.getString("winning_team");

        if (!matchId || !winningTeamName) {
          return interaction.followUp(
            "❌ Please provide both match ID and winning team name (Eagle or Cobra).",
          );
        }

        logger.info(`Attempting to end match ${matchId} with winning team "${winningTeamName}"`);
        const result = await matchService.endMatch(matchId, winningTeamName);

        if (result.success) {
          await interaction.followUp(
            `✅ Match ended successfully! ${result.message}`,
          );
        } else {
          await interaction.followUp(
            `❌ Failed to end match: ${result.message}`,
          );
        }
      } catch (error) {
        logger.error(`Error in endmatch command: ${error}`);
        await interaction.followUp(
          "Failed to end match. Please try again later.",
        );
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("resetqueue")
      .setDescription("Admin: Reset the queue"),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();

      try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has("Administrator")) {
          return interaction.followUp(
            "❌ You do not have permission to use this command.",
          );
        }

        await queueService.clearQueue();

        await interaction.followUp("✅ Queue has been reset.");
      } catch (error) {
        logger.error(`Error in resetqueue command: ${error}`);
        await interaction.followUp(
          "Failed to reset queue. Please try again later.",
        );
      }
    },
  },
];

export async function setupCommandHandlers(client: Client) {
  try {
    logger.info("Setting up local command handling only");

    // Create a collection on client for handling commands
    (client as any).commands = new Collection();

    // Add our commands to the collection for handling
    commands.forEach((command) => {
      (client as any).commands.set(command.data.name, command);
    });

    logger.info("Command handlers registered in the client");
  } catch (error) {
    logger.error(`Error setting up command handlers: ${error}`);
  }
}