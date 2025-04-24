
import { TextChannel, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, Message } from 'discord.js';
import { logger } from '../utils/logger';
import { QueueService } from './queueService';
import { MatchService } from './matchService';
import { IStorage } from '../../storage';
import { getDiscordClient } from '../../discord/bot';
import { formatDuration } from '../utils/timeUtils';

export class QueueDisplayService {
  private static instance: QueueDisplayService | null = null;
  private storage: IStorage;
  private queueService: QueueService;
  private matchService: MatchService;
  private channelId: string = '1364742151996444723';
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
      // Check if we already have a message in the channel
      await this.findExistingMessage();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Create initial display
      await this.refreshQueueDisplay();
      
      logger.info("Queue display initialized successfully");
    } catch (error) {
      logger.error(`Error initializing queue display: ${error}`);
    }
  }

  private async findExistingMessage(): Promise<void> {
    try {
      const client = getDiscordClient();
      if (!client) {
        logger.warn("Cannot find existing message: Discord client not available");
        return;
      }

      const channel = await client.channels.fetch(this.channelId) as TextChannel;
      if (!channel) {
        logger.warn(`Channel with ID ${this.channelId} not found`);
        return;
      }

      // Fetch recent messages to see if our bot already posted a queue status
      const messages = await channel.messages.fetch({ limit: 10 });
      const botMessage = messages.find(msg => 
        msg.author.id === client.user?.id && 
        msg.embeds.length > 0 && 
        msg.embeds.some(embed => embed.title === "Matchmaking Queue")
      );

      if (botMessage) {
        this.displayMessage = botMessage;
        logger.info(`Found existing queue display message with ID: ${botMessage.id}`);
      }
    } catch (error) {
      logger.error(`Error finding existing message: ${error}`);
    }
  }

  private setupEventListeners(): void {
    try {
      // Listen for queue updates with proper ES module imports
      import('../utils/eventEmitter').then(({ EventEmitter, QUEUE_EVENTS, MATCH_EVENTS }) => {
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
      }).catch(err => {
        logger.error(`Error importing event emitter: ${err}`);
      });
    } catch (error) {
      logger.error(`Error setting up event listeners: ${error}`);
    }
  }

  public async refreshQueueDisplay(): Promise<void> {
    try {
      const client = getDiscordClient();
      if (!client) {
        logger.warn("Cannot refresh queue display: Discord client not available");
        return;
      }

      const channel = await client.channels.fetch(this.channelId) as TextChannel;
      if (!channel) {
        logger.warn(`Channel with ID ${this.channelId} not found`);
        return;
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
            components: [row]
          });
          
          // Set up a new collector for the updated message
          this.setupButtonCollector(this.displayMessage);
          
          logger.info("Updated existing queue display message");
        } catch (editError) {
          logger.error(`Error editing existing queue display message: ${editError}`);
          
          // If editing fails, try to create a new message instead
          try {
            const sentMessage = await channel.send({
              embeds: [queueEmbed, ...matchEmbeds],
              components: [row]
            });
            this.displayMessage = sentMessage;
            
            // Set up collector for button interactions
            this.setupButtonCollector(sentMessage);
            
            logger.info(`Created new queue display message after edit failure. ID: ${sentMessage.id}`);
          } catch (sendError) {
            logger.error(`Failed to create new message after edit error: ${sendError}`);
          }
        }
      } else {
        try {
          // Create new message
          const sentMessage = await channel.send({
            embeds: [queueEmbed, ...matchEmbeds],
            components: [row]
          });
          this.displayMessage = sentMessage;
          
          // Set up collector for button interactions
          this.setupButtonCollector(sentMessage);
          
          logger.info(`Created new queue display message with ID: ${sentMessage.id}`);
        } catch (sendError) {
          logger.error(`Error creating new queue display message: ${sendError}`);
        }
      }
    } catch (error) {
      logger.error(`Error refreshing queue display: ${error}`);
    }
  }

  private setupButtonCollector(message: Message): void {
    try {
      // First, check if the message already has any collectors
      // We don't want multiple collectors on the same message
      if (message.createMessageComponentCollector) {
        // Get any existing collectors on this message
        const existingCollector = (message as any)._messageComponentCollector;
        if (existingCollector) {
          logger.info(`Stopping existing collector for message ID: ${message.id}`);
          try {
            existingCollector.stop();
          } catch (stopError) {
            logger.error(`Error stopping existing collector: ${stopError}`);
          }
        }
        
        // Create a new collector with proper timeout and filter
        const collector = message.createMessageComponentCollector({ 
          time: 24 * 60 * 60 * 1000, // 24 hours
          componentType: 2, // Button type
          filter: i => i.message.id === message.id && (i.customId === "join_queue" || i.customId === "leave_queue") // Only collect join/leave interactions for this specific message
        });
        
        logger.info(`Set up new button collector for message ID: ${message.id}`);
        
        collector.on('collect', async (interaction) => {
      if (!interaction.isButton()) return;
      
      // Defer the reply to acknowledge the interaction
      await interaction.deferReply({ ephemeral: true });
      
      try {
        try {
          // Import necessary services
          const { PlayerService } = await import('./playerService');
          const playerService = new PlayerService(this.storage);
          
          // First, log the interaction details for debugging
          logger.info(`Button interaction received from user ${interaction.user.tag} (${interaction.user.id}) with customId: ${interaction.customId}`);
          
          // Get or create player for the user who clicked the button
          // We need to convert the Discord user ID (string) to our internal player ID (number)
          const playerFromDiscord = await playerService.getOrCreatePlayer({
            id: interaction.user.id,
            username: interaction.user.tag,
            discriminator: '',
            avatar: null
          });
          
          if (!playerFromDiscord || typeof playerFromDiscord.id !== 'number') {
            logger.error(`Failed to find or create player for Discord user ${interaction.user.id}. Player object: ${JSON.stringify(playerFromDiscord)}`);
            await interaction.editReply({
              content: "An error occurred while processing your request. Please try again later or use the /queue command instead."
            });
            return;
          }
          
          // Now we have a valid player ID
          const playerId = playerFromDiscord.id;
          logger.info(`Button pressed by player ID: ${playerId} (Discord ID: ${interaction.user.id})`);
          
          if (interaction.customId === "join_queue") {
            // Check if player is already in queue
            const existingQueueEntry = await this.queueService.getPlayerQueueEntry(playerId);
            
            if (existingQueueEntry) {
              logger.info(`Player ${playerId} attempted to join queue but is already in queue`);
              await interaction.editReply({
                content: "You are already in the matchmaking queue."
              });
              return;
            }
            
            // Add player to queue with proper error handling
            try {
              logger.info(`Adding player ${playerId} to queue via button interaction`);
              const queueResult = await this.queueService.addPlayerToQueue(playerId);
              
              if (!queueResult.success) {
                logger.warn(`Failed to add player ${playerId} to queue: ${queueResult.message}`);
                await interaction.editReply({
                  content: `Failed to join queue: ${queueResult.message}`
                });
                return;
              }
              
              // Get updated queue size
              const updatedQueueCount = (await this.queueService.getAllQueueEntries()).length;
              
              logger.info(`Player ${playerId} successfully added to queue. New queue size: ${updatedQueueCount}`);
              await interaction.editReply({
                content: `You have been added to the matchmaking queue! Current queue size: ${updatedQueueCount} players.`
              });
              
              // Check if we have enough players to create a match
              if (interaction.guild) {
                try {
                  await this.queueService.checkAndCreateMatch(interaction.guild);
                } catch (matchError) {
                  logger.error(`Error checking and creating match: ${matchError}`);
                  // Don't fail the interaction due to match creation error
                }
              }
            } catch (queueError) {
              logger.error(`Error adding player ${playerId} to queue: ${queueError}`);
              await interaction.editReply({
                content: "An error occurred while joining the queue. Please try again later."
              }).catch(replyError => 
                logger.error(`Failed to send error reply: ${replyError}`)
              );
            }
            
          } else if (interaction.customId === "leave_queue") {
            try {
              // Check if player is in queue
              const queueEntry = await this.queueService.getPlayerQueueEntry(playerId);
              
              if (!queueEntry) {
                logger.info(`Player ${playerId} attempted to leave queue but is not in queue`);
                await interaction.editReply({
                  content: "You are not currently in the matchmaking queue."
                });
                return;
              }
              
              // Remove player from queue
              logger.info(`Removing player ${playerId} from queue via button interaction`);
              const removeResult = await this.queueService.removePlayerFromQueue(playerId);
              
              if (!removeResult) {
                logger.warn(`Failed to remove player ${playerId} from queue`);
                await interaction.editReply({
                  content: "Failed to leave queue. Please try again later."
                });
                return;
              }
              
              // Get updated queue size
              const updatedQueueCount = (await this.queueService.getAllQueueEntries()).length;
              
              logger.info(`Player ${playerId} successfully removed from queue. New queue size: ${updatedQueueCount}`);
              await interaction.editReply({
                content: `You have been removed from the matchmaking queue. Current queue size: ${updatedQueueCount} players.`
              });
            } catch (leaveError) {
              logger.error(`Error removing player ${playerId} from queue: ${leaveError}`);
              await interaction.editReply({
                content: "An error occurred while leaving the queue. Please try again later."
              }).catch(replyError => 
                logger.error(`Failed to send error reply: ${replyError}`)
              );
            }
          }
        } catch (error) {
          // Catch-all error handler for unexpected issues
          logger.error(`Uncaught error in button interaction handler: ${error}`);
          try {
            await interaction.editReply({
              content: "An unexpected error occurred. Please try again later or use the /queue or /leave commands instead."
            });
          } catch (replyError) {
            logger.error(`Failed to send error reply: ${replyError}`);
          }
        }
        
        // Note: We don't need to manually refresh the queue display here
        // since the queue service emits events that will trigger a refresh
        
      } catch (error) {
        logger.error(`Error processing button interaction: ${error}`);
        await interaction.editReply({
          content: "An error occurred while processing your request. Please try again later."
        });
      }
    });

    collector.on('end', (collected, reason) => {
      logger.info(`Button collector for message ID: ${message.id} ended. Reason: ${reason}. Collected ${collected.size} interactions.`);
      
      // When collector expires, create a new message with fresh buttons
      try {
        this.displayMessage = null;
        this.refreshQueueDisplay()
          .catch(refreshError => {
            logger.error(`Error refreshing queue display after collector end: ${refreshError}`);
          });
      } catch (error) {
        logger.error(`Error handling collector end event: ${error}`);
      }
    });
    
    // Add an error handler to the collector
    collector.on('dispose', () => {
      logger.warn(`Button collector for message ID: ${message.id} was disposed.`);
    });
    
    // Handle collector errors
    if (collector.on && typeof collector.on === 'function') {
      try {
        collector.on('error', (error) => {
          logger.error(`Error in button collector for message ID: ${message.id}: ${error}`);
        });
      } catch (handlerError) {
        logger.error(`Failed to add error handler to collector: ${handlerError}`);
      }
    }
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
        
        // Get player rank
        const { getPlayerRank } = await import("@shared/rankSystem");
        const playerRank = await getPlayerRank(entry.player.mmr, rankTiers);

        return `${index + 1}. ${entry.player.username} [${playerRank.name}] (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
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
          : "No active matches"
      );

    // If there are active matches, fetch detailed information for each
    const matchEmbeds: EmbedBuilder[] = [];
    if (activeMatches.length > 0) {
      // Create a separate embed for each match with detailed information
      for (const match of activeMatches) {
        try {
          // Get detailed match information including teams
          const matchDetails = await this.matchService.getMatchDetails(match.id);

          // Calculate match duration
          const matchDuration = formatDuration(match.createdAt);

          // Create embed for this match
          const matchEmbed = new EmbedBuilder()
            .setColor("#3BA55C")
            .setTitle(`Match #${match.id}`)
            .setDescription(
              `Status: ${match.status} | Started: ${matchDuration} ago`
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
          logger.error(`Error creating match embed for match ${match.id}: ${error}`);
          
          // Add a simple error embed
          matchEmbeds.push(
            new EmbedBuilder()
              .setColor("#ED4245")
              .setTitle(`Match #${match.id}`)
              .setDescription(`Status: ${match.status}\nStarted: ${formatDuration(match.createdAt)}\n⚠️ Could not load detailed information`)
          );
        }
      }
    } else {
      matchEmbeds.push(matchesEmbed);
    }

    return [queueEmbed, ...matchEmbeds];
  }
}
