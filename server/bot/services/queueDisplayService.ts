
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
          logger.info("Updated existing queue display message");
          
          // Every hour, recreate the message to ensure fresh button collectors
          const messageAge = Date.now() - this.displayMessage.createdTimestamp;
          const oneHourMs = 60 * 60 * 1000;
          
          if (messageAge > oneHourMs) {
            logger.info("Message is over an hour old, recreating for fresh collectors");
            // Delete old message
            await this.displayMessage.delete().catch(err => 
              logger.warn(`Could not delete old message: ${err}`)
            );
            
            // Create new message
            const newMessage = await channel.send({
              embeds: [queueEmbed, ...matchEmbeds],
              components: [row]
            });
            this.displayMessage = newMessage;
            
            // Set up new collector
            this.setupButtonCollector(newMessage);
            logger.info(`Recreated queue display message with ID: ${newMessage.id}`);
          }
        } catch (editError) {
          logger.error(`Error editing existing message: ${editError}`);
          logger.info("Creating new message instead");
          
          // If edit fails, create new message
          const newMessage = await channel.send({
            embeds: [queueEmbed, ...matchEmbeds],
            components: [row]
          });
          this.displayMessage = newMessage;
          
          // Set up collector for button interactions
          this.setupButtonCollector(newMessage);
          
          logger.info(`Created new queue display message with ID: ${newMessage.id}`);
        }
      } else {
        // Create new message
        const sentMessage = await channel.send({
          embeds: [queueEmbed, ...matchEmbeds],
          components: [row]
        });
        this.displayMessage = sentMessage;
        
        // Set up collector for button interactions
        this.setupButtonCollector(sentMessage);
        
        logger.info(`Created new queue display message with ID: ${sentMessage.id}`);
      }
    } catch (error) {
      logger.error(`Error refreshing queue display: ${error}`);
    }
  }

  private setupButtonCollector(message: Message): void {
    // Create a collector with a shorter timeout to avoid stale collectors
    const collector = message.createMessageComponentCollector({ 
      time: 6 * 60 * 60 * 1000 // 6 hours instead of 24
    });

    collector.on('collect', async (interaction) => {
      if (!interaction.isButton()) return;
      
      logger.info(`Button interaction received: ${interaction.customId} from user ${interaction.user.tag}`);
      
      try {
        // Use deferUpdate() here instead of deferReply
        // This acknowledges the interaction by updating the original message
        await interaction.deferUpdate();
        logger.info(`Interaction acknowledged with deferUpdate`);
        
        // Import PlayerService here to avoid circular dependencies
        const { PlayerService } = await import('./playerService');
        const playerService = new PlayerService(this.storage);
        
        // Get or create player for the user who clicked the button
        const player = await playerService.getOrCreatePlayer({
          id: interaction.user.id,
          username: interaction.user.tag,
          discriminator: '',
          avatar: null
        });
        
        let feedbackMessage = '';
        let actionPerformed = false;
        
        if (interaction.customId === "join_queue") {
          // Check if player is already in queue
          const existingQueueEntry = await this.queueService.getPlayerQueueEntry(player.id);
          
          if (existingQueueEntry) {
            feedbackMessage = "You are already in the matchmaking queue.";
          } else {
            // Add player to queue
            const queueResult = await this.queueService.addPlayerToQueue(player.id);
            
            if (!queueResult.success) {
              feedbackMessage = `Failed to join queue: ${queueResult.message}`;
            } else {
              // Get updated queue size
              const updatedQueueCount = (await this.queueService.getAllQueueEntries()).length;
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
          const existingQueueEntry = await this.queueService.getPlayerQueueEntry(player.id);
          
          if (!existingQueueEntry) {
            feedbackMessage = "You are not in the matchmaking queue.";
          } else {
            // Remove player from queue
            const leaveResult = await this.queueService.removePlayerFromQueue(player.id);
            
            if (!leaveResult.success) {
              feedbackMessage = `Failed to leave queue: ${leaveResult.message}`;
            } else {
              feedbackMessage = "You have been removed from the matchmaking queue.";
              actionPerformed = true;
            }
          }
        }
        
        // Send an ephemeral follow-up message to give feedback to the user
        await interaction.followUp({
          content: feedbackMessage,
          ephemeral: true
        });
        
        // If an action was performed, manually refresh the queue display
        // This is a backup in case the event system doesn't trigger a refresh
        if (actionPerformed) {
          logger.info("Action performed, forcing queue display refresh");
          // Small delay to ensure database operations complete
          setTimeout(() => {
            this.refreshQueueDisplay()
              .catch(err => logger.error(`Error refreshing queue display after button action: ${err}`));
          }, 500);
        }
        
      } catch (error) {
        logger.error(`Error handling button interaction: ${error}`);
        // Try to respond even if there was an error
        try {
          await interaction.followUp({
            content: "An error occurred while processing your request. Please try again later.",
            ephemeral: true
          });
        } catch (responseError) {
          logger.error(`Failed to send error message to user: ${responseError}`);
        }
      }
    });

    collector.on('end', () => {
      logger.info("Button collector ended, creating new message with fresh buttons");
      // When collector expires, create a new message with fresh buttons
      this.displayMessage = null;
      this.refreshQueueDisplay()
        .catch(err => logger.error(`Error refreshing queue display after collector end: ${err}`));
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
