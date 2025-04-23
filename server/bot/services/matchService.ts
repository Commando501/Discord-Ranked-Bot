import {
  Guild,
  TextChannel,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  CommandInteraction,
  GuildChannel,
  MessageCreateOptions,
  Client,
} from "discord.js";
import { IStorage } from "../../storage";
import { logger } from "../utils/logger";
import { calculateTeamsMMR } from "../utils/helpers";
import { BotConfig } from "@shared/botConfig";
import { getDiscordClient } from "../../discord/bot";
import { QueueService } from "./queueService";

export class MatchService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Get active matches
   */
  async getActiveMatches(): Promise<any[]> {
    return this.storage.getActiveMatches();
  }

  /**
   * Get match details
   */
  async getMatchDetails(matchId: number): Promise<any> {
    const match = await this.storage.getMatch(matchId);
    if (!match) return null;

    // Get teams for this match with players
    const teams = await this.storage.getMatchTeams(matchId);
    return {
      ...match,
      teams,
    };
  }

  /**
   * Get player match results
   */
  async getPlayerMatchResults(
    playerId: number,
    limit: number = 5,
  ): Promise<any[]> {
    return this.storage.getPlayerMatches(playerId, limit);
  }

  /**
   * Logs important events to the configured event log channel
   * @param title Event title
   * @param description Event description
   * @param fields Additional fields to include
   */
  async logEvent(
    title: string,
    description: string,
    fields: { name: string; value: string; inline?: boolean }[] = [],
  ) {
    try {
      const botConfig = await this.storage.getBotConfig();
      const logChannelId = botConfig.general.logEventChannelId;

      if (!logChannelId) {
        logger.debug("No event log channel configured, skipping event logging");
        // Fall back to local logging
        return this.internalLogEvent(title, description, fields);
      }

      // Try to get the Discord client
      try {
        const client = getDiscordClient();
        if (!client || !client.isReady()) {
          logger.warn(
            "Discord client not ready for event logging, using fallback",
          );
          return this.internalLogEvent(title, description, fields);
        }

        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
          logger.warn(
            `Event log channel ${logChannelId} not found or not a text channel, using fallback`,
          );
          return this.internalLogEvent(title, description, fields);
        }

        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle(`📝 ${title}`)
          .setDescription(description)
          .addFields(fields)
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        logger.debug(`Event logged to channel ${logChannelId}: ${title}`);
      } catch (discordError) {
        logger.warn(`Discord logging failed, using fallback: ${discordError}`);
        return this.internalLogEvent(title, description, fields);
      }
    } catch (error) {
      logger.error(`Failed to log event: ${error}`);
      // Make sure we at least log to console
      this.internalLogEvent(title, description, fields);
    }
  }

  async createMatchWithPlayers(
    playerIds: number[],
    guild: Guild,
  ): Promise<{ success: boolean; message: string; matchId?: number }> {
    try {
      if (playerIds.length < 2) {
        return {
          success: false,
          message: "Need at least 2 players to create a match",
        };
      }

      // Create match record
      const match = await this.storage.createMatch({
        status: "WAITING",
      });

      // Divide players into balanced teams
      const players = await Promise.all(
        playerIds.map((id) => this.storage.getPlayer(id)),
      );
      const validPlayers = players.filter(Boolean) as any[];

      if (validPlayers.length < 2) {
        return { success: false, message: "Not enough valid players found" };
      }

      const teamsData = calculateTeamsMMR(validPlayers);

      // Create team records and assign players
      for (const [teamIndex, teamPlayers] of teamsData.teams.entries()) {
        const teamName = teamIndex === 0 ? "Eagle" : "Cobra";
        const avgMMR =
          teamIndex === 0 ? teamsData.team1MMR : teamsData.team2MMR;

        const team = await this.storage.createTeam({
          matchId: match.id,
          name: teamName,
          avgMMR,
        });

        // Add players to team
        for (const player of teamPlayers) {
          await this.storage.addPlayerToTeam({
            teamId: team.id,
            playerId: player.id,
          });
        }
      }

      // Update match status
      await this.storage.updateMatch(match.id, { status: "ACTIVE" });

      // Try to create a match channel if possible
      let matchChannel: TextChannel | null = null;
      let channelCreationFailed = false;
      try {
        // Find or create a category for matches
        let matchCategory = guild.channels.cache.find(
          (channel) =>
            channel.type === ChannelType.GuildCategory &&
            channel.name === "Matches",
        );

        if (!matchCategory) {
          logger.info("Creating new Matches category");
          try {
            matchCategory = await guild.channels.create({
              name: "Matches",
              type: ChannelType.GuildCategory,
            });
            logger.info(
              `Successfully created Matches category with ID: ${matchCategory.id}`,
            );
          } catch (categoryError) {
            logger.error(`Failed to create Matches category: ${categoryError}`);
            throw new Error(
              `Failed to create match category: ${categoryError.message}`,
            );
          }
        } else {
          logger.info(
            `Found existing Matches category with ID: ${matchCategory.id}`,
          );
        }

        // Create a text channel for this match
        logger.info(`Creating match channel for match #${match.id}`);
        try {
          matchChannel = await guild.channels.create({
            name: `match-${match.id}`,
            type: ChannelType.GuildText,
            parent: matchCategory.id,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: ["ViewChannel"],
              },
              // Don't try to set individual user permissions initially
              // Will add users after channel is created
            ],
          });
          logger.info(
            `Successfully created match channel with ID: ${matchChannel.id}`,
          );

          // Store channel and category IDs in the match record
          await this.storage.updateMatch(match.id, {
            channelId: matchChannel.id,
            categoryId: matchCategory.id,
          });
          logger.info(`Updated match record with channel and category IDs`);

          // Now try to add permissions for each player after channel creation
          for (const player of validPlayers) {
            try {
              if (player.discordId) {
                // Use a safer method - edit permissions even if user isn't cached
                await matchChannel.permissionOverwrites.create(
                  player.discordId,
                  {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                  },
                );
                logger.info(
                  `Added permission for player ${player.username} (${player.discordId}) to match channel`,
                );
              }
            } catch (permError) {
              logger.warn(
                `Could not set permissions for player ${player.username} (${player.discordId}): ${permError}`,
              );
              // Continue with other players even if one fails
            }
          }
        } catch (channelError) {
          logger.error(`Failed to create match channel: ${channelError}`);
          channelCreationFailed = true;
          // Don't throw, continue with match creation even without a channel
        }

        // Get the team names from our created teams
        const matchTeams = await this.storage.getMatchTeams(match.id);
        const team1Name = matchTeams[0]?.name || "Eagle";
        const team2Name = matchTeams[1]?.name || "Cobra";

        // Send match details to the channel
        if (matchChannel) {
          const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`Match #${match.id}`)
            .setDescription(
              `Your match has been created! Good luck and have fun!\n\n**Admin Reference**\nMatch ID: \`${match.id}\` (Use \`/endmatch ${match.id} Eagle\` or \`/endmatch ${match.id} Cobra\` to end this match)`,
            )
            .addFields(
              {
                name: `Team ${team1Name} (Avg MMR: ${teamsData.team1MMR})`,
                value: teamsData.teams[0]
                  .map((p) => `<@${p.discordId}> (${p.mmr})`)
                  .join("\n"),
                inline: true,
              },
              {
                name: `Team ${team2Name} (Avg MMR: ${teamsData.team2MMR})`,
                value: teamsData.teams[1]
                  .map((p) => `<@${p.discordId}> (${p.mmr})`)
                  .join("\n"),
                inline: true,
              },
            )
            .setTimestamp();

          // Create vote buttons
          const team1Button = new ButtonBuilder()
            .setCustomId(`vote_${match.id}_team1`)
            .setLabel(`Team ${team1Name} Won`)
            .setStyle(ButtonStyle.Primary);

          const team2Button = new ButtonBuilder()
            .setCustomId(`vote_${match.id}_team2`)
            .setLabel(`Team ${team2Name} Won`)
            .setStyle(ButtonStyle.Danger);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            team1Button,
            team2Button,
          );

          await matchChannel.send({
            content: playerIds
              .map((id) => `<@${players.find((p) => p?.id === id)?.discordId}>`)
              .join(" "),
            embeds: [embed],
            components: [row],
          });
        }
      } catch (error) {
        logger.error(`Error creating match channel: ${error}`);
        // Continue without channel creation if it fails
      }

      // Log the match creation event
      await this.logEvent(
        "Match Created",
        `Match #${match.id} has been created successfully.`,
        [
          { name: "Match ID", value: match.id.toString(), inline: true },
          {
            name: "Players",
            value: validPlayers.length.toString(),
            inline: true,
          },
          {
            name: "Channel",
            value: matchChannel ? `<#${matchChannel.id}>` : "None",
            inline: true,
          },
        ],
      );

      return {
        success: true,
        message: matchChannel
          ? `Match created! Check <#${matchChannel.id}> for details.`
          : channelCreationFailed
            ? "Match created successfully, but channel creation failed. Players can still play."
            : "Match created successfully!",
        matchId: match.id,
      };
    } catch (error) {
      logger.error(`Error creating match: ${error}`);
      return {
        success: false,
        message: "Failed to create match due to an error",
      };
    }
  }

  async endMatch(
    matchId: number,
    winningTeamName: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const match = await this.storage.getMatch(matchId);

      if (!match) {
        return { success: false, message: "Match not found" };
      }

      if (match.status !== "ACTIVE" && match.status !== "WAITING") {
        return {
          success: false,
          message: `Match is already ${match.status.toLowerCase()}`,
        };
      }

      // Get all teams for this match
      const matchTeams = await this.storage.getMatchTeams(matchId);

      if (matchTeams.length < 2) {
        return { success: false, message: "Match does not have enough teams" };
      }

      // Find the winning team by name (case-insensitive)
      const winningTeam = matchTeams.find(
        (team) => team.name.toLowerCase() === winningTeamName.toLowerCase(),
      );

      if (!winningTeam) {
        const validTeams = matchTeams.map((team) => team.name).join(", ");
        logger.info(
          `Team "${winningTeamName}" not found in match ${matchId}. Valid teams are: ${validTeams}`,
        );
        return {
          success: false,
          message: `Team "${winningTeamName}" not found in this match. Valid teams are: ${validTeams}`,
        };
      }

      const winningTeamId = winningTeam.id;

      // Update match status
      await this.storage.updateMatch(matchId, {
        status: "COMPLETED",
        finishedAt: new Date(),
        winningTeamId: winningTeamId,
      });

      // Update player stats for each team
      for (const team of matchTeams) {
        const isWinningTeam = team.id === winningTeamId;

        for (const player of team.players) {
          // Get MMR settings from config
          const botConfig = await this.storage.getBotConfig();
          const mmrSettings = botConfig.mmrSystem;

          // Use kFactor from config for win/loss calculation
          // Calculate win/loss values based on kFactor from config
          const kFactor = mmrSettings.kFactor;
          const mmrGain = Math.round(kFactor * 0.75); // Simplified calculation
          const mmrLoss = Math.round(kFactor * 0.625); // Simplified calculation

          // Calculate MMR change - winners gain, losers lose
          const mmrChange = isWinningTeam ? mmrGain : -mmrLoss;

          // Update streaks
          let winStreak = player.winStreak;
          let lossStreak = player.lossStreak;

          if (isWinningTeam) {
            winStreak += 1;
            lossStreak = 0;
          } else {
            lossStreak += 1;
            winStreak = 0;
          }

          // Apply streak bonuses if applicable (using config values)
          let streakBonus = 0;
          if (winStreak >= mmrSettings.streakSettings.threshold) {
            streakBonus = Math.min(
              mmrSettings.streakSettings.maxBonus,
              Math.floor(
                (winStreak - mmrSettings.streakSettings.threshold + 1) *
                  mmrSettings.streakSettings.bonusPerWin,
              ),
            );
          }

          // Update player stats
          await this.storage.updatePlayer(player.id, {
            mmr: Math.max(1, player.mmr + mmrChange + streakBonus),
            wins: isWinningTeam ? player.wins + 1 : player.wins,
            losses: isWinningTeam ? player.losses : player.losses + 1,
            winStreak,
            lossStreak,
          });
        }
      }

      // Log the match completion event
      const winningPlayers =
        matchTeams.find((team) => team.id === winningTeamId)?.players || [];
      const losingPlayers =
        matchTeams.find((team) => team.id !== winningTeamId)?.players || [];

      await this.logEvent(
        "Match Ended",
        `Match #${matchId} has been completed. Team ${winningTeam.name} has won!`,
        [
          { name: "Match ID", value: matchId.toString(), inline: true },
          { name: "Winning Team", value: winningTeam.name, inline: true },
          {
            name: "Duration",
            value: match.createdAt
              ? `${Math.round((Date.now() - new Date(match.createdAt).getTime()) / 60000)} minutes`
              : "Unknown",
            inline: true,
          },
          {
            name: "Winners",
            value: winningPlayers.map((p) => p.username).join(", ") || "None",
            inline: false,
          },
          {
            name: "Losers",
            value: losingPlayers.map((p) => p.username).join(", ") || "None",
            inline: false,
          },
        ],
      );

      // Start channel deletion countdown
      try {
        const client = getDiscordClient();
        if (!client) {
          logger.error(
            "Discord client not ready or authenticated for match cleanup",
          );

          // Even if cleanup fails, requeue players and mark match as ended
          const queueService = new QueueService(this.storage);
          logger.info(
            `Adding ${winningPlayers.length + losingPlayers.length} players back to queue despite cleanup failure`,
          );

          for (const player of [...winningPlayers, ...losingPlayers]) {
            try {
              const queueResult = await queueService.addPlayerToQueue(
                player.id,
              );
              if (queueResult.success) {
                logger.info(
                  `Added player ${player.username} back to queue despite cleanup failure`,
                );
              } else {
                logger.warn(
                  `Could not add player ${player.username} back to queue: ${queueResult.message}`,
                );
              }
            } catch (queueError) {
              logger.error(
                `Failed to add player ${player.id} back to queue: ${queueError}`,
              );
            }
          }

          await this.logEvent(
            "Match Ended Without Cleanup",
            `Match #${matchId} completed, but channel cleanup failed. Team ${winningTeam.name} has won!`,
            [
              { name: "Match ID", value: matchId.toString(), inline: true },
              { name: "Winning Team", value: winningTeam.name, inline: true },
              {
                name: "Issue",
                value: "Discord client not ready",
                inline: true,
              },
            ],
          );

          return {
            success: true,
            message: `Match #${matchId} completed. Team ${winningTeam.name} has won. Note: Channel cleanup failed, but players were returned to queue.`,
          };
        }

        // Get config to find guild ID
        const botConfig = await this.storage.getBotConfig();
        const guildId = botConfig.general.guildId;

        // First try to get the guild directly by ID from config
        let guild = null;
        if (guildId) {
          guild = client.guilds.cache.get(guildId);
          logger.info(
            `Attempting to get guild using configured ID: ${guildId}`,
          );
        }

        // If not found by ID or no ID configured, try first guild in cache
        if (!guild) {
          guild = client.guilds.cache.first();
          logger.info(
            `Attempting to get first guild in cache: ${guild?.id || "None found"}`,
          );
        }

        // If still no guild, try to get guild based on match configuration
        if (!guild) {
          // Instead of attempting to fetch guilds, let's log all known guilds
          logger.info(
            "No guild found by ID, logging all available guilds in cache",
          );
          const guildCount = client.guilds.cache.size;

          if (guildCount > 0) {
            client.guilds.cache.forEach((g) => {
              logger.info(`Available guild in cache: ${g.name} (${g.id})`);
            });
            // Try first guild again now that we've logged all guilds
            guild = client.guilds.cache.first();
          } else {
            logger.warn(`No guilds available in cache (count: ${guildCount})`);
            // Don't try to fetch - that requires authentication which might not be ready
          }
        }

        if (!guild) {
          logger.error(
            "No guild available for match cleanup after multiple attempts",
          );
          throw new Error("No guild available");
        }

        // First try to get the channel by stored ID
        let matchChannel = match.channelId
          ? guild.channels.cache.get(match.channelId)
          : null;

        // If not found by ID, try by name as fallback
        if (!matchChannel) {
          logger.warn(
            `Channel ID ${match.channelId} not found, attempting to find by name...`,
          );
          matchChannel = guild.channels.cache.find(
            (channel) => channel.name === `match-${matchId}`,
          );
        }

        if (!matchChannel) {
          logger.error(`Match channel for match ${matchId} not found`);
          throw new Error("Match channel not found");
        }

        if (!matchChannel.isTextBased()) {
          logger.error(
            `Match channel for match ${matchId} is not a text channel`,
          );
          throw new Error("Match channel is not a text channel");
        }

        logger.info(
          `Found match channel ${matchChannel.name} (${matchChannel.id}) for cleanup`,
        );

        const countdownSeconds = 10;
        let secondsLeft = countdownSeconds;

        // Send countdown message with clear error handling
        let countdownMessage;
        try {
          countdownMessage = await matchChannel.send(
            `Match completed! Channel will be deleted in ${countdownSeconds} seconds...`,
          );
          logger.info(
            `Sent countdown message ${countdownMessage.id} to channel ${matchChannel.id}`,
          );
        } catch (msgError) {
          logger.error(`Failed to send countdown message: ${msgError}`);
          throw new Error("Failed to send countdown message");
        }

        const interval = setInterval(async () => {
          try {
            secondsLeft--;
            if (secondsLeft > 0) {
              await countdownMessage.edit(
                `Match completed! Channel will be deleted in ${secondsLeft} seconds...`,
              );
            } else {
              clearInterval(interval);
              logger.info(
                `Countdown complete, processing match cleanup for match ${matchId}`,
              );

              // Add players back to queue using the singleton instance
              const queueService = QueueService.getInstance(this.storage);
              logger.info(
                `Adding ${winningPlayers.length + losingPlayers.length} players back to queue`,
              );
              
              // Get all player IDs from this match
              const allPlayerIds = [...winningPlayers, ...losingPlayers].map(p => p.id);
              
              // Get or create group for these players
              let groupId: string;
              if (queueService.currentActiveGroup) {
                // Check if all players from this match are in the current active group
                const currentGroupPlayers = Array.from(queueService.playerGroups.get(queueService.currentActiveGroup)?.keys() || []);
                const allPlayersInGroup = allPlayerIds.every(id => currentGroupPlayers.includes(id));
                
                if (allPlayersInGroup && allPlayerIds.length === currentGroupPlayers.length) {
                  groupId = queueService.currentActiveGroup;
                  logger.info(`Using existing player group ${groupId} for match ${matchId}`);
                } else {
                  groupId = queueService.createPlayerGroup(allPlayerIds);
                  logger.info(`Created new player group ${groupId} for match ${matchId}`);
                }
              } else {
                groupId = queueService.createPlayerGroup(allPlayerIds);
                logger.info(`Created new player group ${groupId} for match ${matchId}`);
              }
              
              // Record losses for losing players
              for (const player of losingPlayers) {
                const hitLossLimit = queueService.recordPlayerLoss(player.id, groupId);
                if (hitLossLimit) {
                  logger.info(`Player ${player.username} (ID: ${player.id}) has hit the loss limit in group ${groupId}`);
                }
              }

              // First, prepare players with their priorities before batch processing
              const playersToRequeue = [];
              
              // Mark all players as being processed at once
              for (const player of [...winningPlayers, ...losingPlayers]) {
                queueService.markPlayerAsProcessing(player.id);
              }
              
              try {
                // Calculate priorities for all players
                for (const player of [...winningPlayers, ...losingPlayers]) {
                  // Set priority based on win/loss status
                  let priority = 0;
                  const isWinner = winningPlayers.some(p => p.id === player.id);
                  const losses = queueService.getPlayerLosses(player.id, groupId);
                  
                  if (isWinner) {
                    priority = 100; // Highest priority for winners
                  } else if (losses < 2) {
                    priority = 50;  // Medium priority for players with 1 loss
                  }
                  
                  playersToRequeue.push({
                    player,
                    priority,
                    groupId
                  });
                }
                
                // Use a transaction for batch re-queuing
                await withTransaction(async (tx) => {
                  // Perform batch inserts grouped by priority level for efficiency
                  const batchInserts = {};
                  
                  // Group players by priority
                  for (const entry of playersToRequeue) {
                    if (!batchInserts[entry.priority]) {
                      batchInserts[entry.priority] = [];
                    }
                    batchInserts[entry.priority].push(entry.player.id);
                  }
                  
                  // Insert each priority group in a single batch operation
                  for (const [priority, playerIds] of Object.entries(batchInserts)) {
                    try {
                      logger.info(`Batch adding ${playerIds.length} players with priority ${priority}`);
                      for (const playerId of playerIds) {
                        await this.storage.addPlayerToQueue({
                          playerId,
                          priority: parseInt(priority),
                        }, tx);
                      }
                    } catch (batchError) {
                      logger.error(`Error in batch queue addition for priority ${priority}: ${batchError}`);
                      throw batchError;
                    }
                  }
                  
                  logger.info(`Successfully batch re-queued ${playersToRequeue.length} players`);
                  return true;
                });
                
              } catch (queueError) {
                logger.error(`Failed in batch player re-queuing: ${queueError}`);
                // Continue with deletion even if re-queuing has errors
              } finally {
                // Unmark all players regardless of success
                for (const entry of playersToRequeue) {
                  queueService.unmarkPlayerAsProcessing(entry.player.id);
                }
              }

              // Delete the channel
              try {
                logger.info(
                  `Attempting to delete channel ${matchChannel.name} (${matchChannel.id})`,
                );
                await matchChannel.delete();
                logger.info(
                  `Successfully deleted channel for match ${matchId}`,
                );
              } catch (deleteError) {
                logger.error(`Failed to delete channel: ${deleteError}`);
                // Even if channel deletion fails, we've already re-queued players
              }
            }
          } catch (intervalError) {
            logger.error(`Error in countdown interval: ${intervalError}`);
            clearInterval(interval);
          }
        }, 1000);
      } catch (error) {
        logger.error(`Error handling match channel cleanup: ${error}`);

        // Even if there's an error with channel cleanup, make sure players get back into queue
        try {
          const queueService = QueueService.getInstance(this.storage);
          for (const player of [...winningPlayers, ...losingPlayers]) {
            const queueResult = await queueService.addPlayerToQueue(player.id);
            if (queueResult.success) {
              logger.info(
                `Added player ${player.username} back to queue during error recovery`,
              );
            } else {
              logger.warn(
                `Could not add player ${player.username} back to queue during error recovery: ${queueResult.message}`,
              );
            }
          }
        } catch (recoveryError) {
          logger.error(
            `Failed in recovery attempt to add players back to queue: ${recoveryError}`,
          );
        }
      }

      return {
        success: true,
        message: `Match #${matchId} has been completed. Team ${winningTeam.name} has won!`,
      };
    } catch (error) {
      logger.error(`Error ending match: ${error}`);
      return { success: false, message: "Failed to end match due to an error" };
    }
  }

  async initiateVoteKick(
    initiatorId: number,
    targetId: number,
    interaction: CommandInteraction,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (initiatorId === targetId) {
        return { success: false, message: "You cannot vote to kick yourself" };
      }

      // Find a match where both players are participating
      const initiator = await this.storage.getPlayer(initiatorId);
      const target = await this.storage.getPlayer(targetId);

      if (!initiator || !target) {
        return { success: false, message: "One or both players not found" };
      }

      // Get active matches and check if both players are in the same match
      const activeMatches = await this.storage.getActiveMatches();

      let matchWithBothPlayers: any = null;
      let initiatorTeam: any = null;
      let targetTeam: any = null;

      for (const match of activeMatches) {
        for (const team of match.teams) {
          const hasInitiator = team.players.some((p) => p.id === initiatorId);
          const hasTarget = team.players.some((p) => p.id === targetId);

          if (hasInitiator) initiatorTeam = team;
          if (hasTarget) targetTeam = team;

          if (initiatorTeam && targetTeam) {
            matchWithBothPlayers = match;
            break;
          }
        }

        if (matchWithBothPlayers) break;
      }

      if (!matchWithBothPlayers) {
        return {
          success: false,
          message: "You are not in the same active match as the target player",
        };
      }

      // No longer restricting votekick to same team
      // Players can now initiate votekicks against players on either team

      // Check if there's already an active vote kick for this player
      const existingVoteKick = await this.storage.getActiveVoteKick(
        matchWithBothPlayers.id,
        targetId,
      );

      if (existingVoteKick) {
        return {
          success: false,
          message: "There is already an active vote kick for this player",
        };
      }

      // Create a new vote kick
      const voteKick = await this.storage.createVoteKick({
        matchId: matchWithBothPlayers.id,
        targetPlayerId: targetId,
        initiatorPlayerId: initiatorId,
        status: "PENDING",
      });

      // Add initiator's vote
      await this.storage.addVoteKickVote({
        voteKickId: voteKick.id,
        playerId: initiatorId,
        approve: true,
      });

      // Get vote system settings from config
      const botConfig = await this.storage.getBotConfig();
      const voteSettings = botConfig.matchRules.voteSystemSettings;

      // Get total match players since we're now allowing cross-team votes
      const allPlayers = match.teams.flatMap(team => team.players);
      // Calculate required votes based on majority percentage from config
      const requiredVotes = Math.max(
        voteSettings.minVotesNeeded,
        Math.ceil(allPlayers.length * (voteSettings.majorityPercent / 100)),
      );

      // Create voting message
      const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle(`Vote Kick: ${target.username}`)
        .setDescription(
          `<@${initiator.discordId}> has initiated a vote to kick <@${target.discordId}> from the match.`,
        )
        .addFields(
          { name: "Match", value: `#${matchWithBothPlayers.id}`, inline: true },
          { name: "Target Team", value: targetTeam.name, inline: true },
          { name: "Votes Required", value: `1/${requiredVotes}`, inline: true },
        )
        .setFooter({ text: 'Type "yes" or "no" in this channel to vote' })
        .setTimestamp();

      // Try to find the match channel first by stored ID, then by name
      let matchChannel = null;

      // First try to get the channel by stored ID if available
      if (matchWithBothPlayers.channelId) {
        matchChannel = interaction.guild?.channels.cache.get(
          matchWithBothPlayers.channelId,
        );
        if (matchChannel) {
          logger.info(
            `Found match channel by stored ID: ${matchWithBothPlayers.channelId}`,
          );
        }
      }

      // If not found by ID, try by name as fallback
      if (!matchChannel) {
        logger.warn(
          `Channel ID ${matchWithBothPlayers.channelId} not found or not available, attempting to find by name...`,
        );
        matchChannel = interaction.guild?.channels.cache.find(
          (channel) => channel.name === `match-${matchWithBothPlayers.id}`,
        );
        if (matchChannel) {
          logger.info(
            `Found match channel by name: match-${matchWithBothPlayers.id}`,
          );
        }
      }

      if (matchChannel && matchChannel.isTextBased()) {
        await matchChannel.send({
          content: allPlayers.map((p) => `<@${p.discordId}>`).join(" "),
          embeds: [embed],
        });
      } else {
        // If no match channel, reply in the command channel
        await interaction.channel?.send({ embeds: [embed] });
      }

      // Handle vote collection and processing would be done in a message event handler
      // That part is not implemented here but would be added to bot/index.ts

      // Log the vote kick initiation
      await this.logEvent(
        "Vote Kick Initiated",
        `<@${initiator.discordId}> has initiated a vote to kick <@${target.discordId}> from match #${matchWithBothPlayers.id}.`,
        [
          {
            name: "Match ID",
            value: matchWithBothPlayers.id.toString(),
            inline: true,
          },
          { name: "Initiator Team", value: initiatorTeam.name, inline: true },
          { name: "Target Team", value: targetTeam.name, inline: true },
          {
            name: "Required Votes",
            value: requiredVotes.toString(),
            inline: true,
          },
          { name: "Initiator", value: initiator.username, inline: true },
          { name: "Target", value: target.username, inline: true },
        ],
      );

      return {
        success: true,
        message:
          'Vote kick initiated. Team members can now vote by typing "yes" or "no".',
      };
    } catch (error) {
      logger.error(`Error initiating vote kick: ${error}`);
      return {
        success: false,
        message: "Failed to initiate vote kick due to an error",
      };
    }
  }
  
  /**
   * Handles a successful vote kick, removing the player from the match
   * and performing necessary cleanup, similar to a player leaving
   * @param voteKickId The ID of the successful vote kick
   * @param guildId Optional guild ID for finding the Discord guild
   */
  async handleSuccessfulVoteKick(
    voteKickId: number,
    guildId?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get the vote kick details
      const voteKick = await this.storage.getVoteKick(voteKickId);
      
      if (!voteKick) {
        return { success: false, message: "Vote kick not found" };
      }
      
      if (voteKick.status !== "PENDING") {
        return { 
          success: false, 
          message: `Vote kick is already ${voteKick.status.toLowerCase()}` 
        };
      }
      
      // Get player information
      const kickedPlayer = await this.storage.getPlayer(voteKick.targetPlayerId);
      
      if (!kickedPlayer) {
        return { success: false, message: "Kicked player not found" };
      }
      
      // Update vote kick status
      await this.storage.updateVoteKick(voteKickId, { status: "APPROVED" });
      
      // Log the event
      await this.logEvent(
        "Player Kicked",
        `Player ${kickedPlayer.username} (ID: ${kickedPlayer.id}) has been kicked from match #${voteKick.matchId} by vote.`,
        [
          { name: "Match ID", value: voteKick.matchId.toString(), inline: true },
          { name: "Kicked Player", value: kickedPlayer.username, inline: true },
          { name: "Vote Kick ID", value: voteKickId.toString(), inline: true },
        ]
      );
      
      // Use the existing match cancellation flow to handle the kicked player properly
      // This will return other players to queue but not the kicked player
      const result = await this.handleMatchCancellationWithExclusion(
        voteKick.matchId,
        kickedPlayer.id
      );
      
      if (!result.success) {
        logger.error(`Failed to handle match cancellation after vote kick: ${result.message}`);
        return {
          success: false,
          message: `Player was kicked but there was an error cancelling the match: ${result.message}`
        };
      }
      
      return {
        success: true,
        message: `${kickedPlayer.username} has been kicked from match #${voteKick.matchId}. Match cancelled and other players returned to queue.`
      };
    } catch (error) {
      logger.error(`Error handling successful vote kick: ${error}`);
      return {
        success: false,
        message: "Failed to process vote kick due to an error"
      };
    }
  }

  async handleMatchCancellation(
    matchId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const match = await this.storage.getMatch(matchId);

      if (!match) {
        return { success: false, message: "Match not found" };
      }

      if (match.status === "COMPLETED" || match.status === "CANCELLED") {
        return {
          success: false,
          message: `Match is already ${match.status.toLowerCase()}`,
        };
      }

      // Get match players before updating status
      const teams = await this.storage.getMatchTeams(matchId);
      const players = teams.flatMap((team) => team.players);

      // Update match status
      await this.storage.updateMatch(matchId, {
        status: "CANCELLED",
        finishedAt: new Date(),
      });

      // Delete Discord channel
      try {
        const client = getDiscordClient();
        if (!client) {
          logger.error(
            "Discord client not ready or authenticated for match cancellation",
          );

          // Even if channel cleanup fails, return players to queue
          const queueService = QueueService.getInstance(this.storage);
          for (const player of players) {
            try {
              const queueResult = await queueService.addPlayerToQueue(
                player.id,
              );
              if (queueResult.success) {
                logger.info(
                  `Added player ${player.username} back to queue despite cleanup failure (cancellation)`,
                );
              } else {
                logger.warn(
                  `Could not add player ${player.username} back to queue during cancellation: ${queueResult.message}`,
                );
              }
            } catch (queueError) {
              logger.error(
                `Failed to add player ${player.id} back to queue during cancellation: ${queueError}`,
              );
            }
          }

          await this.logEvent(
            "Match Cancelled Without Cleanup",
            `Match #${matchId} cancelled, but channel cleanup failed.`,
            [
              { name: "Match ID", value: matchId.toString(), inline: true },
              {
                name: "Players Returned",
                value: players.length.toString(),
                inline: true,
              },
              {
                name: "Issue",
                value: "Discord client not ready",
                inline: true,
              },
            ],
          );

          return {
            success: true,
            message: `Match #${matchId} cancelled and players returned to queue. Note: Channel cleanup was skipped.`,
          };
        }

        // Get config to find guild ID
        const botConfig = await this.storage.getBotConfig();
        const guildId = botConfig.general.guildId;

        // First try to get the guild directly by ID from config
        let guild = null;
        if (guildId) {
          guild = client.guilds.cache.get(guildId);
          logger.info(
            `Attempting to get guild for cancellation using configured ID: ${guildId}`,
          );
        }

        // If not found by ID or no ID configured, try first guild in cache
        if (!guild) {
          guild = client.guilds.cache.first();
          logger.info(
            `Attempting to get first guild in cache for cancellation: ${guild?.id || "None found"}`,
          );
        }

        // If still no guild, try to get guild based on match configuration
        if (!guild) {
          // Instead of attempting to fetch guilds, let's log all known guilds
          logger.info(
            "No guild found by ID for cancellation, logging all available guilds in cache",
          );
          const guildCount = client.guilds.cache.size;

          if (guildCount > 0) {
            client.guilds.cache.forEach((g) => {
              logger.info(
                `Available guild in cache for cancellation: ${g.name} (${g.id})`,
              );
            });
            // Try first guild again now that we've logged all guilds
            guild = client.guilds.cache.first();
          } else {
            logger.warn(
              `No guilds available in cache for cancellation (count: ${guildCount})`,
            );
            // Don't try to fetch - that requires authentication which might not be ready
          }
        }

        if (!guild) {
          logger.error(
            "No guild available for match cancellation after multiple attempts",
          );
          throw new Error("No guild available");
        }

        // First try to get the channel by stored ID
        let matchChannel = match.channelId
          ? guild.channels.cache.get(match.channelId)
          : null;

        // If not found by ID, try by name as fallback
        if (!matchChannel) {
          logger.warn(
            `Channel ID ${match.channelId} not found, attempting to find by name...`,
          );
          matchChannel = guild.channels.cache.find(
            (channel) => channel.name === `match-${matchId}`,
          );
        }

        if (!matchChannel) {
          logger.error(
            `Match channel for match ${matchId} not found during cancellation`,
          );
          // We'll still add players back to queue even if channel isn't found
        } else if (matchChannel.isTextBased()) {
          logger.info(
            `Found match channel ${matchChannel.name} (${matchChannel.id}) for cancellation cleanup`,
          );

          // Start countdown
          const countdownSeconds = 10;
          let secondsLeft = countdownSeconds;

          try {
            const countdownMessage = await matchChannel.send(
              `Match cancelled! Channel will be deleted in ${countdownSeconds} seconds...`,
            );
            logger.info(
              `Sent cancellation countdown message to channel ${matchChannel.id}`,
            );

            const interval = setInterval(async () => {
              try {
                secondsLeft--;
                if (secondsLeft > 0) {
                  await countdownMessage.edit(
                    `Match cancelled! Channel will be deleted in ${secondsLeft} seconds...`,
                  );
                } else {
                  clearInterval(interval);
                  logger.info(
                    `Cancellation countdown complete for match ${matchId}`,
                  );

                  // Delete the channel
                  try {
                    logger.info(
                      `Attempting to delete channel ${matchChannel.name} (${matchChannel.id})`,
                    );
                    await matchChannel.delete();
                    logger.info(
                      `Successfully deleted channel for cancelled match ${matchId}`,
                    );
                  } catch (deleteError) {
                    logger.error(
                      `Failed to delete channel during cancellation: ${deleteError}`,
                    );
                  }
                }
              } catch (intervalError) {
                logger.error(
                  `Error in cancellation countdown interval: ${intervalError}`,
                );
                clearInterval(interval);
              }
            }, 1000);
          } catch (messageError) {
            logger.error(
              `Failed to send cancellation countdown message: ${messageError}`,
            );
          }
        }
      } catch (error) {
        logger.error(`Error handling match channel cancellation: ${error}`);
      }

      // Return players to queue - use the players we already retrieved at the beginning
      try {
        const queueService = QueueService.getInstance(this.storage);
        logger.info(
          `Adding ${players.length} players back to queue after match cancellation`,
        );

        // Process player re-queueing sequentially with proper tracking
        // This prevents race conditions when multiple players from the same match 
        // may be processed simultaneously
        for (const player of players) {
          try {
            // Mark player as being processed before queueing to prevent race conditions
            queueService.markPlayerAsProcessing(player.id);
            
            const queueResult = await queueService.addPlayerToQueue(player.id);
            if (queueResult.success) {
              logger.info(
                `Added player ${player.username} (ID: ${player.id}) back to queue after cancellation`,
              );
            } else {
              logger.warn(
                `Could not add player ${player.username} (ID: ${player.id}) back to queue after cancellation: ${queueResult.message}`,
              );
              // Unmark player if addition to queue failed (they won't be unmarked by addPlayerToQueue)
              queueService.unmarkPlayerAsProcessing(player.id);
            }
          } catch (queueError) {
            logger.error(
              `Failed to add player ${player.id} back to queue during cancellation: ${queueError}`,
            );
            // Ensure player is unmarked even if an error occurred
            queueService.unmarkPlayerAsProcessing(player.id);
          }
        }
      } catch (playersError) {
        logger.error(
          `Failed to process players for queue reentry: ${playersError}`,
        );
        
        // If we had a catastrophic failure, try to clean up any players that might still be marked
        try {
          const queueService = QueueService.getInstance(this.storage);
          for (const player of players) {
            queueService.unmarkPlayerAsProcessing(player.id);
          }
        } catch (cleanupError) {
          logger.error(`Failed to clean up player processing markers: ${cleanupError}`);
        }
      }

      // Log the cancellation
      await this.logEvent(
        "Match Cancelled",
        `Match #${matchId} has been cancelled.`,
        [
          { name: "Match ID", value: matchId.toString(), inline: true },
          {
            name: "Players Returned",
            value: players.length.toString(),
            inline: true,
          },
        ],
      );

      return {
        success: true,
        message: `Match #${matchId} cancelled. ${players.length} players returned to queue.`,
      };
    } catch (error) {
      logger.error(`Error cancelling match: ${error}`);
      return {
        success: false,
        message: "Failed to cancel match due to an error",
      };
    }
  }

  /**
   * Cancels a match and cleans up Discord channels WITHOUT returning players to queue
   */
  async handleMatchCancellationNoQueue(
    matchId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const match = await this.storage.getMatch(matchId);

      if (!match) {
        return { success: false, message: "Match not found" };
      }

      if (match.status === "COMPLETED" || match.status === "CANCELLED") {
        return {
          success: false,
          message: `Match is already ${match.status.toLowerCase()}`,
        };
      }

      // Get match players before updating status
      const teams = await this.storage.getMatchTeams(matchId);
      const players = teams.flatMap((team) => team.players);

      // Update match status
      await this.storage.updateMatch(matchId, {
        status: "CANCELLED",
        finishedAt: new Date(),
      });

      // Delete Discord channel
      try {
        const client = getDiscordClient();
        if (!client) {
          logger.error(
            "Discord client not ready or authenticated for match reset",
          );

          await this.logEvent(
            "Match Reset Without Cleanup",
            `Match #${matchId} reset, but channel cleanup failed.`,
            [
              { name: "Match ID", value: matchId.toString(), inline: true },
              {
                name: "Players Affected",
                value: players.length.toString(),
                inline: true,
              },
              {
                name: "Issue",
                value: "Discord client not ready",
                inline: true,
              },
            ],
          );

          return {
            success: true,
            message: `Match #${matchId} cancelled without returning players to queue. Note: Channel cleanup was skipped.`,
          };
        }

        // Get config to find guild ID
        const botConfig = await this.storage.getBotConfig();
        const guildId = botConfig.general.guildId;

        // First try to get the guild directly by ID from config
        let guild = null;
        if (guildId) {
          guild = client.guilds.cache.get(guildId);
          logger.info(
            `Attempting to get guild for match reset using configured ID: ${guildId}`,
          );
        }

        // If not found by ID or no ID configured, try first guild in cache
        if (!guild) {
          guild = client.guilds.cache.first();
          logger.info(
            `Attempting to get first guild in cache for match reset: ${guild?.id || "None found"}`,
          );
        }

        // If still no guild, try to get guild based on match configuration
        if (!guild) {
          // Instead of attempting to fetch guilds, let's log all known guilds
          logger.info(
            "No guild found by ID for match reset, logging all available guilds in cache",
          );
          const guildCount = client.guilds.cache.size;

          if (guildCount > 0) {
            client.guilds.cache.forEach((g) => {
              logger.info(
                `Available guild in cache for match reset: ${g.name} (${g.id})`,
              );
            });
            // Try first guild again now that we've logged all guilds
            guild = client.guilds.cache.first();
          } else {
            logger.warn(
              `No guilds available in cache for match reset (count: ${guildCount})`,
            );
            // Don't try to fetch - that requires authentication which might not be ready
          }
        }

        if (!guild) {
          logger.error(
            "No guild available for match reset after multiple attempts",
          );
          throw new Error("No guild available");
        }

        // First try to get the channel by stored ID
        let matchChannel = match.channelId
          ? guild.channels.cache.get(match.channelId)
          : null;

        // If not found by ID, try by name as fallback
        if (!matchChannel) {
          logger.warn(
            `Channel ID ${match.channelId} not found, attempting to find by name...`,
          );
          matchChannel = guild.channels.cache.find(
            (channel) => channel.name === `match-${matchId}`,
          );
        }

        if (!matchChannel) {
          logger.error(
            `Match channel for match ${matchId} not found during match reset`,
          );
        } else if (matchChannel.isTextBased()) {
          logger.info(
            `Found match channel ${matchChannel.name} (${matchChannel.id}) for match reset cleanup`,
          );

          // Start countdown
          const countdownSeconds = 10;
          let secondsLeft = countdownSeconds;

          try {
            const countdownMessage = await matchChannel.send(
              `Match reset! Players will NOT be returned to queue. Channel will be deleted in ${countdownSeconds} seconds...`,
            );
            logger.info(
              `Sent match reset countdown message to channel ${matchChannel.id}`,
            );

            const interval = setInterval(async () => {
              try {
                secondsLeft--;
                if (secondsLeft > 0) {
                  await countdownMessage.edit(
                    `Match reset! Players will NOT be returned to queue. Channel will be deleted in ${secondsLeft} seconds...`,
                  );
                } else {
                  clearInterval(interval);
                  logger.info(
                    `Match reset countdown complete for match ${matchId}`,
                  );

                  // Delete the channel
                  try {
                    logger.info(
                      `Attempting to delete channel ${matchChannel.name} (${matchChannel.id})`,
                    );
                    await matchChannel.delete();
                    logger.info(
                      `Successfully deleted channel for reset match ${matchId}`,
                    );
                  } catch (deleteError) {
                    logger.error(
                      `Failed to delete channel during match reset: ${deleteError}`,
                    );
                  }
                }
              } catch (intervalError) {
                logger.error(
                  `Error in match reset countdown interval: ${intervalError}`,
                );
                clearInterval(interval);
              }
            }, 1000);
          } catch (messageError) {
            logger.error(
              `Failed to send match reset countdown message: ${messageError}`,
            );
          }
        }
      } catch (error) {
        logger.error(`Error handling match reset channel cleanup: ${error}`);
      }

      // Log the cancellation without queue
      await this.logEvent(
        "Match Reset",
        `Match #${matchId} has been reset (cancelled without requeue).`,
        [
          { name: "Match ID", value: matchId.toString(), inline: true },
          {
            name: "Players Affected",
            value: players.length.toString(),
            inline: true,
          },
        ],
      );

      return {
        success: true,
        message: `Match #${matchId} cancelled without returning players to queue.`,
      };
    } catch (error) {
      logger.error(`Error resetting match: ${error}`);
      return {
        success: false,
        message: "Failed to reset match due to an error",
      };
    }
  }

  /**
   * Cancels a match and cleans up Discord channels, returning all players except the excluded player to queue
   * @param matchId The ID of the match to cancel
   * @param excludePlayerId Player ID to exclude from re-queuing (the player who initiated the leave)
   */
  async handleMatchCancellationWithExclusion(
    matchId: number,
    excludePlayerId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const match = await this.storage.getMatch(matchId);

      if (!match) {
        return { success: false, message: "Match not found" };
      }

      if (match.status === "COMPLETED" || match.status === "CANCELLED") {
        return {
          success: false,
          message: `Match is already ${match.status.toLowerCase()}`,
        };
      }

      // Get match players before updating status
      const teams = await this.storage.getMatchTeams(matchId);
      const players = teams.flatMap((team) => team.players);
      
      // Find the excluded player to include in logs
      const excludedPlayer = players.find(player => player.id === excludePlayerId);
      
      // Update match status
      await this.storage.updateMatch(matchId, {
        status: "CANCELLED",
        finishedAt: new Date(),
      });

      // Delete Discord channel
      try {
        const client = getDiscordClient();
        if (!client) {
          logger.error(
            "Discord client not ready or authenticated for match cancellation",
          );

          // Even if channel cleanup fails, return players to queue except the excluded one
          const queueService = QueueService.getInstance(this.storage);
          for (const player of players) {
            // Skip the player who left
            if (player.id === excludePlayerId) continue;
            
            try {
              const queueResult = await queueService.addPlayerToQueue(
                player.id,
              );
              if (queueResult.success) {
                logger.info(
                  `Added player ${player.username} back to queue despite cleanup failure (player leave)`,
                );
              } else {
                logger.warn(
                  `Could not add player ${player.username} back to queue during player leave: ${queueResult.message}`,
                );
              }
            } catch (queueError) {
              logger.error(
                `Failed to add player ${player.id} back to queue during player leave: ${queueError}`,
              );
            }
          }

          await this.logEvent(
            "Player Left Match",
            `Player ${excludedPlayer?.username || `ID: ${excludePlayerId}`} left match #${matchId}, but channel cleanup failed.`,
            [
              { name: "Match ID", value: matchId.toString(), inline: true },
              {
                name: "Players Returned",
                value: (players.length - 1).toString(),
                inline: true,
              },
              {
                name: "Player Who Left",
                value: excludedPlayer?.username || `ID: ${excludePlayerId}`,
                inline: true,
              },
              {
                name: "Issue",
                value: "Discord client not ready",
                inline: true,
              },
            ],
          );

          return {
            success: true,
            message: `Match #${matchId} cancelled due to player leaving. Note: Channel cleanup was skipped.`,
          };
        }

        // Get config to find guild ID
        const botConfig = await this.storage.getBotConfig();
        const guildId = botConfig.general.guildId;

        // First try to get the guild directly by ID from config
        let guild = null;
        if (guildId) {
          guild = client.guilds.cache.get(guildId);
          logger.info(
            `Attempting to get guild for cancellation using configured ID: ${guildId}`,
          );
        }

        // If not found by ID or no ID configured, try first guild in cache
        if (!guild) {
          guild = client.guilds.cache.first();
          logger.info(
            `Attempting to get first guild in cache for cancellation: ${guild?.id || "None found"}`,
          );
        }

        // If still no guild, try to get guild based on match configuration
        if (!guild) {
          // Instead of attempting to fetch guilds, let's log all known guilds
          logger.info(
            "No guild found by ID for cancellation, logging all available guilds in cache",
          );
          const guildCount = client.guilds.cache.size;

          if (guildCount > 0) {
            client.guilds.cache.forEach((g) => {
              logger.info(
                `Available guild in cache for cancellation: ${g.name} (${g.id})`,
              );
            });
            // Try first guild again now that we've logged all guilds
            guild = client.guilds.cache.first();
          } else {
            logger.warn(
              `No guilds available in cache for cancellation (count: ${guildCount})`,
            );
            // Don't try to fetch - that requires authentication which might not be ready
          }
        }

        if (!guild) {
          logger.error(
            "No guild available for match cancellation after multiple attempts",
          );
          throw new Error("No guild available");
        }

        // First try to get the channel by stored ID
        let matchChannel = match.channelId
          ? guild.channels.cache.get(match.channelId)
          : null;

        // If not found by ID, try by name as fallback
        if (!matchChannel) {
          logger.warn(
            `Channel ID ${match.channelId} not found, attempting to find by name...`,
          );
          matchChannel = guild.channels.cache.find(
            (channel) => channel.name === `match-${matchId}`,
          );
        }

        if (!matchChannel) {
          logger.error(
            `Match channel for match ${matchId} not found during cancellation`,
          );
          // We'll still add players back to queue even if channel isn't found
        } else if (matchChannel.isTextBased()) {
          logger.info(
            `Found match channel ${matchChannel.name} (${matchChannel.id}) for cancellation cleanup`,
          );

          // Start countdown
          const countdownSeconds = 10;
          let secondsLeft = countdownSeconds;

          try {
            const countdownMessage = await matchChannel.send(
              `Match cancelled - Player ${excludedPlayer?.username || `ID: ${excludePlayerId}`} left the match! Channel will be deleted in ${countdownSeconds} seconds...`,
            );
            logger.info(
              `Sent cancellation countdown message to channel ${matchChannel.id}`,
            );

            const interval = setInterval(async () => {
              try {
                secondsLeft--;
                if (secondsLeft > 0) {
                  await countdownMessage.edit(
                    `Match cancelled - Player ${excludedPlayer?.username || `ID: ${excludePlayerId}`} left the match! Channel will be deleted in ${secondsLeft} seconds...`,
                  );
                } else {
                  clearInterval(interval);
                  logger.info(
                    `Cancellation countdown complete for match ${matchId}`,
                  );

                  // Delete the channel
                  try {
                    logger.info(
                      `Attempting to delete channel ${matchChannel.name} (${matchChannel.id})`,
                    );
                    await matchChannel.delete();
                    logger.info(
                      `Successfully deleted channel for cancelled match ${matchId}`,
                    );
                  } catch (deleteError) {
                    logger.error(
                      `Failed to delete channel during cancellation: ${deleteError}`,
                    );
                  }
                }
              } catch (intervalError) {
                logger.error(
                  `Error in cancellation countdown interval: ${intervalError}`,
                );
                clearInterval(interval);
              }
            }, 1000);
          } catch (messageError) {
            logger.error(
              `Failed to send cancellation countdown message: ${messageError}`,
            );
          }
        }
      } catch (error) {
        logger.error(`Error handling match channel cancellation: ${error}`);
      }

      // Return players to queue - use the players we already retrieved at the beginning
      try {
        const queueService = QueueService.getInstance(this.storage);
        const playerCount = players.length - 1; // Exclude the player who left
        logger.info(
          `Adding ${playerCount} players back to queue after player left match`,
        );

        // Process player re-queueing sequentially with proper tracking
        // This prevents race conditions where multiple players from the same match
        // are all being processed at once, potentially creating multiple new matches
        for (const player of players) {
          // Skip the player who initiated the leave
          if (player.id === excludePlayerId) continue;
          
          try {
            // Mark player as being processed BEFORE queue service processes them
            // This helps prevent the player from being selected for another match in a race condition
            queueService.markPlayerAsProcessing(player.id);
            
            // Add to queue with proper error handling
            const queueResult = await queueService.addPlayerToQueue(player.id);
            
            if (queueResult.success) {
              logger.info(
                `Added player ${player.username} (ID: ${player.id}) back to queue after player left match`,
              );
            } else {
              logger.warn(
                `Could not add player ${player.username} (ID: ${player.id}) back to queue after player left match: ${queueResult.message}`,
              );
              // Even if adding to queue failed, make sure player is unmarked
              queueService.unmarkPlayerAsProcessing(player.id);
            }
          } catch (queueError) {
            logger.error(
              `Failed to add player ${player.id} back to queue during player leave: ${queueError}`,
            );
            // Ensure player is unmarked even if an error occurred
            queueService.unmarkPlayerAsProcessing(player.id);
          }
        }
      } catch (playersError) {
        logger.error(
          `Failed to process players for queue reentry after player left: ${playersError}`,
        );
        
        // If we had a catastrophic failure, try to clean up any players that might still be marked as processing
        try {
          const queueService = QueueService.getInstance(this.storage);
          for (const player of players) {
            if (player.id !== excludePlayerId) {
              queueService.unmarkPlayerAsProcessing(player.id);
            }
          }
        } catch (cleanupError) {
          logger.error(`Failed to clean up player processing markers: ${cleanupError}`);
        }
      }

      // Log the cancellation due to player leaving
      await this.logEvent(
        "Player Left Match",
        `Player ${excludedPlayer?.username || `ID: ${excludePlayerId}`} left match #${matchId}. The match has been cancelled.`,
        [
          { name: "Match ID", value: matchId.toString(), inline: true },
          {
            name: "Players Returned to Queue",
            value: (players.length - 1).toString(),
            inline: true,
          },
          {
            name: "Player Who Left",
            value: excludedPlayer?.username || `ID: ${excludePlayerId}`,
            inline: true,
          },
        ],
      );

      return {
        success: true,
        message: `Match #${matchId} cancelled because a player left. ${players.length - 1} players returned to queue.`,
      };
    } catch (error) {
      logger.error(`Error cancelling match due to player leaving: ${error}`);
      return {
        success: false,
        message: "Failed to process player leaving match due to an error",
      };
    }
  }

  private internalLogEvent = async (
    title: string,
    description: string,
    fields: Array<{ name: string; value: string; inline?: boolean }>,
  ) => {
    try {
      // Implement logging logic here
      logger.info(`${title}: ${description}`);
    } catch (error) {
      logger.error(`Failed to log event: ${error}`);
    }
  };
}


// Import required modules
import { withTransaction } from '../../db';

/**
 * Creates a match with players using a database transaction for atomicity
 * @param playerIds Array of player IDs to include in the match
 * @param guild Discord guild where the match will be created
 * @param tx Optional transaction object for database operations
 * @returns Result object with success status and match ID
 */
export async function createMatchWithPlayersTransaction(
  playerIds: number[],
  guild: Guild,
  tx?: any
): Promise<{ success: boolean; message: string; matchId?: number }> {
  try {
    if (playerIds.length < 2) {
      return {
        success: false,
        message: "Need at least 2 players to create a match",
      };
    }

    // Create match record within the transaction if provided
    const match = await this.storage.createMatch({
      status: "WAITING",
    }, tx);

    // Divide players into balanced teams
    const players = await Promise.all(
      playerIds.map((id) => this.storage.getPlayer(id)),
    );
    const validPlayers = players.filter(Boolean) as any[];

    if (validPlayers.length < 2) {
      return { success: false, message: "Not enough valid players found" };
    }

    const teamsData = calculateTeamsMMR(validPlayers);

    // Create team records and assign players within the transaction
    for (const [teamIndex, teamPlayers] of teamsData.teams.entries()) {
      const teamName = teamIndex === 0 ? "Eagle" : "Cobra";
      const avgMMR =
        teamIndex === 0 ? teamsData.team1MMR : teamsData.team2MMR;

      const team = await this.storage.createTeam({
        matchId: match.id,
        name: teamName,
        avgMMR,
      }, tx);

      // Add players to team within the transaction
      for (const player of teamPlayers) {
        await this.storage.addPlayerToTeam({
          teamId: team.id,
          playerId: player.id,
        }, tx);
      }
    }

    // Update match status within the transaction
    await this.storage.updateMatch(match.id, { status: "ACTIVE" }, tx);

    // Try to create a match channel if possible
    // Note: Discord channel creation happens outside the DB transaction
    // since it's a separate system
    let matchChannel: TextChannel | null = null;
    let channelCreationFailed = false;
    
    try {
      // [The channel creation code remains the same as in createMatchWithPlayers]
      // Find or create a category for matches
      let matchCategory = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildCategory &&
          channel.name === "Matches",
      );

      if (!matchCategory) {
        logger.info("Creating new Matches category");
        try {
          matchCategory = await guild.channels.create({
            name: "Matches",
            type: ChannelType.GuildCategory,
          });
          logger.info(
            `Successfully created Matches category with ID: ${matchCategory.id}`,
          );
        } catch (categoryError) {
          logger.error(`Failed to create Matches category: ${categoryError}`);
          throw new Error(
            `Failed to create match category: ${categoryError.message}`,
          );
        }
      } else {
        logger.info(
          `Found existing Matches category with ID: ${matchCategory.id}`,
        );
      }

      // Create a text channel for this match
      logger.info(`Creating match channel for match #${match.id}`);
      try {
        matchChannel = await guild.channels.create({
          name: `match-${match.id}`,
          type: ChannelType.GuildText,
          parent: matchCategory.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: ["ViewChannel"],
            },
          ],
        });
        logger.info(
          `Successfully created match channel with ID: ${matchChannel.id}`,
        );

        // Store channel and category IDs in the match record
        // Use the transaction if provided
        await this.storage.updateMatch(match.id, {
          channelId: matchChannel.id,
          categoryId: matchCategory.id,
        }, tx);
        logger.info(`Updated match record with channel and category IDs`);

        // Now try to add permissions for each player after channel creation
        for (const player of validPlayers) {
          try {
            if (player.discordId) {
              await matchChannel.permissionOverwrites.create(
                player.discordId,
                {
                  ViewChannel: true,
                  SendMessages: true,
                  ReadMessageHistory: true,
                },
              );
              logger.info(
                `Added permission for player ${player.username} (${player.discordId}) to match channel`,
              );
            }
          } catch (permError) {
            logger.warn(
              `Could not set permissions for player ${player.username} (${player.discordId}): ${permError}`,
            );
          }
        }
      } catch (channelError) {
        logger.error(`Failed to create match channel: ${channelError}`);
        channelCreationFailed = true;
      }

      // Get the team names from our created teams - use the transaction if provided
      const matchTeams = await this.storage.getMatchTeams(match.id, tx);
      const team1Name = matchTeams[0]?.name || "Eagle";
      const team2Name = matchTeams[1]?.name || "Cobra";

      // Send match details to the channel
      if (matchChannel) {
        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle(`Match #${match.id}`)
          .setDescription(
            `Your match has been created! Good luck and have fun!\n\n**Admin Reference**\nMatch ID: \`${match.id}\` (Use \`/endmatch ${match.id} Eagle\` or \`/endmatch ${match.id} Cobra\` to end this match)`,
          )
          .addFields(
            {
              name: `Team ${team1Name} (Avg MMR: ${teamsData.team1MMR})`,
              value: teamsData.teams[0]
                .map((p) => `<@${p.discordId}> (${p.mmr})`)
                .join("\n"),
              inline: true,
            },
            {
              name: `Team ${team2Name} (Avg MMR: ${teamsData.team2MMR})`,
              value: teamsData.teams[1]
                .map((p) => `<@${p.discordId}> (${p.mmr})`)
                .join("\n"),
              inline: true,
            },
          )
          .setTimestamp();

        // Create vote buttons
        const team1Button = new ButtonBuilder()
          .setCustomId(`vote_${match.id}_team1`)
          .setLabel(`Team ${team1Name} Won`)
          .setStyle(ButtonStyle.Primary);

        const team2Button = new ButtonBuilder()
          .setCustomId(`vote_${match.id}_team2`)
          .setLabel(`Team ${team2Name} Won`)
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          team1Button,
          team2Button,
        );

        await matchChannel.send({
          content: playerIds
            .map((id) => `<@${players.find((p) => p?.id === id)?.discordId}>`)
            .join(" "),
          embeds: [embed],
          components: [row],
        });
      }
    } catch (error) {
      logger.error(`Error creating match channel: ${error}`);
      // Continue without channel creation if it fails
    }

    // Log the match creation event
    await this.logEvent(
      "Match Created",
      `Match #${match.id} has been created successfully.`,
      [
        { name: "Match ID", value: match.id.toString(), inline: true },
        {
          name: "Players",
          value: validPlayers.length.toString(),
          inline: true,
        },
        {
          name: "Channel",
          value: matchChannel ? `<#${matchChannel.id}>` : "None",
          inline: true,
        },
      ],
    );

    return {
      success: true,
      message: matchChannel
        ? `Match created! Check <#${matchChannel.id}> for details.`
        : channelCreationFailed
          ? "Match created successfully, but channel creation failed. Players can still play."
          : "Match created successfully!",
      matchId: match.id,
    };
  } catch (error) {
    logger.error(`Error creating match with transaction: ${error}`);
    return {
      success: false,
      message: "Failed to create match due to an error",
    };
  }
}
