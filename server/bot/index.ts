import { Client, IntentsBitField, Events, Collection, GatewayIntentBits } from 'discord.js';
import { logger } from './utils/logger';
import { storage } from '../storage';
import { QueueService } from './services/queueService';
import { PlayerService } from './services/playerService';
import { getDiscordClient as getEnhancedClient, initializeBot as initializeEnhancedBot } from '../discord/bot';
import { MatchService } from './services/matchService';

export class DiscordBot {
  private client: Client | null = null;
  private queueService: QueueService;
  private playerService: PlayerService;
  private matchService: MatchService;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 15000; // 15 seconds

  constructor() {
    this.queueService = new QueueService(storage);
    this.playerService = new PlayerService(storage);
    this.matchService = new MatchService(storage);
  }

  private setupEventHandlers(client: Client) {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isCommand()) return;

      try {
        const { commandName } = interaction;

        // Quick registration of new players if needed
        if (!interaction.user.bot) {
          await this.playerService.ensurePlayerExists({
            id: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            avatar: interaction.user.avatar
          });
        }

        // Add our commands to the collection for handling
        // Import the commands dynamically to avoid potential circular dependencies
        const botCommands = await import('./commands');
        await botCommands.setupCommandHandlers(client);

        const command = (client as any).commands?.get(commandName);
        if (!command) {
          logger.warn(`Command not found in bot handler: ${commandName}`);
          return;
        }

        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing command: ${error}`);

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ 
            content: 'An error occurred while executing this command.',
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: 'An error occurred while executing this command.',
            ephemeral: true 
          });
        }
      }
    });

    client.on(Events.Error, (error) => {
      logger.error(`Discord client error in bot handler: ${error}`);
    });
  }

  public async start() {
    try {
      // Use the enhanced client from discord/bot.ts which has reconnection logic
      await initializeEnhancedBot();
      this.client = getEnhancedClient();

      if (!this.client) {
        throw new Error('Failed to initialize Discord client');
      }

      // Set up our event handlers
      this.setupEventHandlers(this.client);
      logger.info('Discord bot started successfully');

      // Start a periodic connection check
      this.startConnectionHealthCheck();

      return this.client;
    } catch (error) {
      logger.error(`Failed to start bot: ${error}`);
      throw error;
    }
  }

  private startConnectionHealthCheck() {
    setInterval(() => {
      // Check if we have a working client from the enhanced module
      const currentClient = getEnhancedClient();
      if (!currentClient) {
        logger.warn('Bot health check: No Discord client available from enhanced module');
        // Update our reference to the client
        this.client = null;
      } else {
        // Update our reference to the client
        this.client = currentClient;
      }
    }, 30000); // Check every 30 seconds
  }

  public async stop() {
    // We don't need to destroy the client here since the enhanced version handles that
    logger.info('Discord bot stop requested (handled by enhanced client)');
  }
}

// Initialize the bot when the file is imported
let bot: DiscordBot | null = null;

export async function initializeBot() {
  if (!bot) {
    bot = new DiscordBot();
    await bot.start();
  }
  return bot;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down bot...');
  if (bot) await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down bot...');
  if (bot) await bot.stop();
  process.exit(0);
});

// Initialize the bot if this file is run directly
if (require.main === module) {
  initializeBot().catch(err => {
    logger.error('Failed to initialize bot:', err);
    process.exit(1);
  });
}