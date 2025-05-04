import {
  TextChannel,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Message,
} from "discord.js";
import { logger } from "../utils/logger";
import { QueueService } from "./queueService";
import { MatchService } from "./matchService";
import { IStorage } from "../../storage";
import { getDiscordClient } from "../../discord/bot";
import { formatDuration } from "../utils/timeUtils";
import path from "path";
import fs from "fs";

export class QueueDisplayService {
  private static instance: QueueDisplayService | null = null;
  private storage: IStorage;
  private queueService: QueueService;
  private matchService: MatchService;
  private channelId: string = "1364742151996444723";
  private displayMessage: Message | null = null;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.queueService = QueueService.getInstance(storage);
    this.matchService = new MatchService(storage);

    // Singleton pattern
    if (!QueueDisplayService.instance) {
      QueueDisplayService.instance = this;
      logger.info("QueueDisplayService initialized as singleton instance");
      this.initialize();
    }
  }

  public static getInstance(storage: IStorage): QueueDisplayService {
    if (!QueueDisplayService.instance) {
      QueueDisplayService.instance = new QueueDisplayService(storage);
    }
    return QueueDisplayService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      logger.info("Starting QueueDisplayService initialization");

      // First, clean up any existing duplicate messages in the channel
      // We'll do this immediately on initialization to ensure a clean state
      const existingMessage = await this.cleanupDuplicateMessages();
      if (existingMessage) {
        this.displayMessage = existingMessage;
        logger.info(`Using existing message with ID ${existingMessage.id} after initialization cleanup`);
      } else {
        logger.info("No existing messages found during initialization cleanup");
      }

      // Setup event listeners
      this.setupEventListeners();

      // Create initial display or update the existing one
      // We'll introduce a small delay to ensure any previous operations have completed
      setTimeout(async () => {
        await this.refreshQueueDisplay();
        logger.info("Initial queue display refreshed after initialization");
      }, 1000);

      logger.info("Queue display initialized successfully");
    } catch (error) {
      logger.error(`Error initializing queue display: ${error}`);
    }
  }

  // This method is replaced by the more comprehensive cleanupDuplicateMessages()
  // We'll keep it for backwards compatibility but just defer to the new method
  private async findExistingMessage(): Promise<void> {
    try {
      const existingMessage = await this.cleanupDuplicateMessages();
      if (existingMessage) {
        this.displayMessage = existingMessage;
      }
    } catch (error) {
      logger.error(`Error finding existing message: ${error}`);
    }
  }

  private setupEventListeners(): void {
    try {
      // Listen for queue updates with proper ES module imports
      import("../utils/eventEmitter")
        .then(({ EventEmitter, QUEUE_EVENTS, MATCH_EVENTS }) => {
          const emitter = EventEmitter.getInstance();

          // Register for queue events
          emitter.on(QUEUE_EVENTS.UPDATED, () => {
            logger.info("Queue updated event received, refreshing display");
            this.refreshQueueDisplay();
          });

          emitter.on(MATCH_EVENTS.CREATED, () => {
            logger.info("Match created event received, refreshing display");
            this.refreshQueueDisplay();
          });

          emitter.on(MATCH_EVENTS.ENDED, () => {
            logger.info("Match ended event received, refreshing display");
            this.refreshQueueDisplay();
          });

          logger.info("Queue display event listeners registered successfully");
        })
        .catch((err) => {
          logger.error(`Error importing event emitter: ${err}`);
        });
    } catch (error) {
      logger.error(`Error setting up event listeners: ${error}`);
    }
  }

  /**
   * Force recreation of the queue display message
   * This is useful for ensuring fresh button collectors
   * Now with improved duplicate detection and prevention
   */
  public async forceMessageRecreation(): Promise<void> {
    try {
      logger.info("Starting forced recreation of queue display");

      const client = getDiscordClient();
      if (!client) {
        logger.warn("Cannot recreate message: Discord client not available");
        return;
      }

      const channel = (await client.channels.fetch(this.channelId)) as TextChannel;
      if (!channel) {
        logger.warn(`Channel with ID ${this.channelId} not found`);
        return;
      }

      // Use our enhanced cleanup method to handle existing messages
      logger.info("Cleaning up any existing messages before force recreation");
      await this.cleanupDuplicateMessages();

      // Clear the existing message reference
      this.displayMessage = null;

      // Short delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get fresh queue and match data for the new message
      const [queueEmbed, ...matchEmbeds] = await this.createQueueEmbeds();

      // Create button row
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

      // Create a fresh message
      const newMessage = await channel.send({
        embeds: [queueEmbed, ...matchEmbeds],
        components: [row],
      });

      this.displayMessage = newMessage;

      // Set up fresh collectors
      this.setupButtonCollector(newMessage);

      logger.info(`Force recreation completed successfully: new message ID ${newMessage.id}`);

      // One final verification to check for any duplicates that might have slipped through
      setTimeout(async () => {
        await this.cleanupDuplicateMessages();
      }, 2000);

    } catch (error) {
      logger.error(`Error during force recreation of queue display: ${error}`);

      // If there was an error, still try to ensure we don't have duplicates
      setTimeout(async () => {
        try {
          await this.cleanupDuplicateMessages();
          await this.refreshQueueDisplay();
        } catch (cleanupError) {
          logger.error(`Error during post-error cleanup: ${cleanupError}`);
        }
      }, 5000);
    }
  }

  /**
   * Comprehensive cleanup of any duplicate queue messages
   * This resolves the ongoing issue with multiple queue embeds appearing
   */
  private async cleanupDuplicateMessages(): Promise<Message | null> {
    try {
      const client = getDiscordClient();
      if (!client) {
        logger.warn("Cannot cleanup duplicates: Discord client not available");
        return null;
      }

      const channel = (await client.channels.fetch(this.channelId)) as TextChannel;
      if (!channel) {
        logger.warn(`Channel with ID ${this.channelId} not found`);
        return null;
      }

      // Fetch a larger number of messages to ensure we catch all duplicates
      // This is more thorough than the previous approach that only fetched 10-20 messages
      const allMessages = await channel.messages.fetch({ limit: 50 });

      // Find all queue messages by our bot
      const queueMessages = allMessages.filter(
        (msg) =>
          msg.author.id === client.user?.id &&
          msg.embeds.length > 0 &&
          msg.embeds.some((embed) => embed.title === "Matchmaking Queue")
      );

      if (queueMessages.size === 0) {
        logger.info("No existing queue messages found during cleanup");
        return null;
      }

      if (queueMessages.size > 1) {
        logger.warn(`Found ${queueMessages.size} queue messages during cleanup - removing duplicates`);

        // Sort messages by creation timestamp (newest first)
        const sortedMessages = [...queueMessages.values()].sort(
          (a, b) => b.createdTimestamp - a.createdTimestamp
        );

        // Keep the most recent message
        const mostRecentMessage = sortedMessages[0];
        logger.info(`Keeping most recent queue message with ID: ${mostRecentMessage.id}`);

        // Delete all other queue messages
        for (let i = 1; i < sortedMessages.length; i++) {
          try {
            await sortedMessages[i].delete();
            logger.info(`Deleted duplicate queue message with ID: ${sortedMessages[i].id}`);
          } catch (deleteError) {
            logger.error(`Failed to delete duplicate message: ${deleteError}`);
          }

          // Add a small delay between deletions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        return mostRecentMessage;
      } else {
        // Only one message found
        const singleMessage = queueMessages.first()!;
        logger.debug(`Found single queue message with ID: ${singleMessage.id}`);
        return singleMessage;
      }
    } catch (error) {
      logger.error(`Error cleaning up duplicate messages: ${error}`);
      return null;
    }
  }

  public async refreshQueueDisplay(): Promise<void> {
    try {
      const client = getDiscordClient();
      if (!client) {
        logger.warn(
          "Cannot refresh queue display: Discord client not available",
        );
        return;
      }

      const channel = (await client.channels.fetch(
        this.channelId,
      )) as TextChannel;
      if (!channel) {
        logger.warn(`Channel with ID ${this.channelId} not found`);
        return;
      }

      // First, clean up any duplicate messages and get the most recent one
      // This runs on every refresh to ensure we never have duplicates
      const existingMessage = await this.cleanupDuplicateMessages();
      if (existingMessage) {
        this.displayMessage = existingMessage;
      }

      // Create embeds with queue and match information
      const [queueEmbed, ...matchEmbeds] = await this.createQueueEmbeds();

      // Create button row
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

      if (this.displayMessage) {
        try {
          // Update existing message
          await this.displayMessage.edit({
            embeds: [queueEmbed, ...matchEmbeds],
            components: [row],
          });
          logger.info("Updated existing queue display message");

          // Every time we edit the message, ensure there's a collector
          this.ensureButtonCollector(this.displayMessage);

          // Every 20 minutes, recreate the message to ensure fresh button collectors
          const messageAge = Date.now() - this.displayMessage.createdTimestamp;
          const twentyMinutesMs = 20 * 60 * 1000;

          if (messageAge > twentyMinutesMs) {
            logger.info(
              "Message is over 20 minutes old, recreating for fresh collectors",
            );
            // Delete old message
            await this.displayMessage
              .delete()
              .catch((err) =>
                logger.warn(`Could not delete old message: ${err}`),
              );

            // Create new message
            const newMessage = await channel.send({
              embeds: [queueEmbed, ...matchEmbeds],
              components: [row],
            });
            this.displayMessage = newMessage;

            // Set up new collector
            this.setupButtonCollector(newMessage);
            logger.info(
              `Recreated queue display message with ID: ${newMessage.id}`,
            );
          }
        } catch (editError) {
          logger.error(`Error editing existing message: ${editError}`);
          logger.info("Creating new message instead");

          // First try to delete all existing messages
          await this.cleanupDuplicateMessages();
          this.displayMessage = null;

          // If edit fails, create new message
          const newMessage = await channel.send({
            embeds: [queueEmbed, ...matchEmbeds],
            components: [row],
          });
          this.displayMessage = newMessage;

          // Set up collector for button interactions
          this.setupButtonCollector(newMessage);

          logger.info(
            `Created new queue display message with ID: ${newMessage.id}`,
          );
        }
      } else {
        // No message reference in memory, but run cleanup again to be certain
        await this.cleanupDuplicateMessages();

        // Create a fresh message
        const sentMessage = await channel.send({
          embeds: [queueEmbed, ...matchEmbeds],
          components: [row],
        });
        this.displayMessage = sentMessage;

        // Set up collector for button interactions
        this.setupButtonCollector(sentMessage);

        logger.info(
          `Created new queue display message with ID: ${sentMessage.id}`,
        );
      }
    } catch (error) {
      logger.error(`Error refreshing queue display: ${error}`);
    }
  }

  private ensureButtonCollector(message: Message): void {
    // Check if the message already has an active collector
    // We can't directly check for collectors, so we'll add a custom property
    if ((message as any)._hasQueueCollector) {
      logger.debug(`Message ${message.id} already has an active collector`);
      return;
    }

    // Add collector to message
    this.setupButtonCollector(message);
    logger.info(`Ensured button collector exists for message ${message.id}`);
  }

  private setupButtonCollector(message: Message): void {
    // Create a collector with a longer timeout to avoid stale collectors
    const collector = message.createMessageComponentCollector({
      time: 8 * 60 * 60 * 1000, // 8 hours
    });

    // Mark this message as having a collector (custom property)
    (message as any)._hasQueueCollector = true;

    collector.on("collect", async (interaction) => {
      if (!interaction.isButton()) return;

      logger.info(
        `Button interaction received: ${interaction.customId} from user ${interaction.user.tag}`,
      );

      try {
        // Use deferUpdate() here instead of deferReply
        // This acknowledges the interaction by updating the original message
        await interaction.deferUpdate();
        logger.info(`Interaction acknowledged with deferUpdate`);

        // Import PlayerService here to avoid circular dependencies
        const { PlayerService } = await import("./playerService");
        const playerService = new PlayerService(this.storage);

        // Get or create player for the user who clicked the button
        const player = await playerService.getOrCreatePlayer({
          id: interaction.user.id,
          username: interaction.user.tag,
          discriminator: "",
          avatar: null,
        });

        let feedbackMessage = "";
        let actionPerformed = false;

        if (interaction.customId === "join_queue") {
          // Check if player is already in queue
          const existingQueueEntry =
            await this.queueService.getPlayerQueueEntry(player.id);

          if (existingQueueEntry) {
            feedbackMessage = "You are already in the matchmaking queue.";
          } else {
            // Add player to queue
            const queueResult = await this.queueService.addPlayerToQueue(
              player.id,
            );

            if (!queueResult.success) {
              feedbackMessage = `Failed to join queue: ${queueResult.message}`;
            } else {
              // Get updated queue size
              const updatedQueueCount = (
                await this.queueService.getAllQueueEntries()
              ).length;
              feedbackMessage = `You have been added to the matchmaking queue! Current queue size: ${updatedQueueCount} players.`;
              actionPerformed = true;

              // Check if we can create a match
              if (interaction.guild) {
                await this.queueService.checkAndCreateMatch(interaction.guild);
              }
            }
          }
        } else if (interaction.customId === "leave_queue") {
          // Check if player is in queue
          const existingQueueEntry =
            await this.queueService.getPlayerQueueEntry(player.id);

          if (!existingQueueEntry) {
            feedbackMessage = "You are not in the matchmaking queue.";
          } else {
            // Remove player from queue - handling boolean return value
            const leaveResult = await this.queueService.removePlayerFromQueue(
              player.id,
            );

            // The removePlayerFromQueue method returns a boolean, not an object
            if (leaveResult === false) {
              feedbackMessage =
                "Failed to leave queue. Please try again later.";
            } else {
              feedbackMessage =
                "You have been removed from the matchmaking queue.";
              actionPerformed = true;
            }
          }
        }

        // Send an ephemeral follow-up message to give feedback to the user
        await interaction.followUp({
          content: feedbackMessage,
          ephemeral: true,
        });

        // If an action was performed, manually refresh the queue display
        // This is a backup in case the event system doesn't trigger a refresh
        if (actionPerformed) {
          logger.info("Action performed, forcing queue display refresh");
          // Small delay to ensure database operations complete
          setTimeout(() => {
            this.refreshQueueDisplay().catch((err) =>
              logger.error(
                `Error refreshing queue display after button action: ${err}`,
              ),
            );
          }, 500);
        }
      } catch (error) {
        logger.error(`Error handling button interaction: ${error}`);
        // Try to respond even if there was an error
        try {
          await interaction.followUp({
            content:
              "An error occurred while processing your request. Please try again later.",
            ephemeral: true,
          });
        } catch (responseError) {
          logger.error(
            `Failed to send error message to user: ${responseError}`,
          );
        }
      }
    });

    collector.on("end", () => {
      logger.info(
        "Button collector ended, creating new message with fresh buttons",
      );
      // When collector expires, create a new message with fresh buttons
      this.displayMessage = null;
      this.refreshQueueDisplay().catch((err) =>
        logger.error(
          `Error refreshing queue display after collector end: ${err}`,
        ),
      );
    });
  }

  private async createQueueEmbeds(): Promise<EmbedBuilder[]> {
    // Get queue and match data
    const queuePlayers = await this.queueService.getQueuePlayersWithInfo();
    const activeMatches = await this.matchService.getActiveMatches();

    // Create queue embed
    const queueEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("Matchmaking Queue")
      .setDescription(`${queuePlayers.length} players in queue`);

    if (queuePlayers.length > 0) {
      // Get rank tiers
      let rankTiers = await this.storage.getRankTiers();

      // Build queue list with rank info
      const queueListPromises = queuePlayers.map(async (entry, index) => {
        const waitTime = formatDuration(entry.joinedAt);

        // Get player rank using the same method as the list command
        let playerRank = null;

        // First, try to load directly from discordbot-config.json to ensure we get the full set of tiers with subdivisions
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
                `Using ${rankTiers.length} detailed rank tiers from config file for queue display`,
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

        // Find the appropriate tier by checking MMR ranges explicitly
        let foundTier = null;

        // For each tier, explicitly define its range and check if player MMR falls within it
        for (let i = 0; i < sortedTiers.length; i++) {
          const currentTier = sortedTiers[i];
          const prevTier = i > 0 ? sortedTiers[i - 1] : null;

          // Upper bound is inclusive (<=), lower bound is previous tier's threshold + 1 or 0
          const upperBound = currentTier.mmrThreshold;
          const lowerBound = prevTier ? prevTier.mmrThreshold + 1 : 0;

          if (
            entry.player.mmr >= lowerBound &&
            entry.player.mmr <= upperBound
          ) {
            foundTier = currentTier;
            break;
          }
        }

        // If tier found, use it
        if (foundTier) {
          playerRank = foundTier;
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
          try {
            const client = getDiscordClient();
            if (client) {
              const emojiId = rankEmojiMap[playerRank.name];
              const emoji = client.emojis.cache.get(emojiId);

              if (emoji) {
                rankEmoji = ` ${emoji}`;
              }
            }
          } catch (error) {
            logger.warn(
              `Error getting emoji for rank ${playerRank.name}: ${error}`,
            );
          }
        }

        return `${index + 1}. ${entry.player.username} [${playerRank.name}${rankEmoji}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
      });

      const queueList = (await Promise.all(queueListPromises)).join("\n");
      queueEmbed.addFields({ name: "Players", value: queueList });
    }

    // Only create match embeds if there are active matches
    const matchEmbeds: EmbedBuilder[] = [];
    if (activeMatches.length > 0) {
      // Create a summary embed for active matches
      const matchesSummaryEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("Active Matches")
        .setDescription(`${activeMatches.length} active matches`);

      matchEmbeds.push(matchesSummaryEmbed);

      // Create a separate embed for each match with detailed information
      for (const match of activeMatches) {
        try {
          // Get detailed match information including teams
          const matchDetails = await this.matchService.getMatchDetails(
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
                .map((player) => `${player.username} (MMR: ${player.mmr})`)
                .join("\n");

              matchEmbed.addFields({
                name: `Team ${team.name} (Avg MMR: ${team.avgMMR})`,
                value: teamPlayers || "No players",
                inline: true,
              });
            });
          }

          matchEmbeds.push(matchEmbed);
        } catch (error) {
          logger.error(
            `Error creating match embed for match ${match.id}: ${error}`,
          );

          // Add a simple error embed
          matchEmbeds.push(
            new EmbedBuilder()
              .setColor("#ED4245")
              .setTitle(`Match #${match.id}`)
              .setDescription(
                `Status: ${match.status}\nStarted: ${formatDuration(match.createdAt)}\n⚠️ Could not load detailed information`,
              ),
          );
        }
      }
    }

    // Return only queue embed if no matches, otherwise return queue embed and match embeds
    return activeMatches.length > 0
      ? [queueEmbed, ...matchEmbeds]
      : [queueEmbed];
  }
}