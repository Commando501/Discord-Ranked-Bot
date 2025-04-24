import { Client, Events, GatewayIntentBits, Collection, Options, Partials } from 'discord.js';
import { logger } from '../bot/utils/logger';
import { registerCommands, getCommands } from './commands';
import { storage } from '../storage';

// Global variables for connection management
let client: Client | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 10000; // 10 seconds

// Create Discord client with required intents
function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ],
    // Add these options to improve user caching
    makeCache: Options.cacheWithLimits({
      GuildMemberManager: {
        maxSize: 200, // Increase member cache size
        keepOverLimit: member => member.user.bot
      }
    }),
    // Fetch members for guilds to improve caching
    partials: [Partials.GuildMember]
  });
}

// Setup event handlers for the client
function setupEventHandlers(discordClient: Client) {
    // Client ready event
    discordClient.on(Events.ClientReady, async (readyClient) => {
      logger.info(`Discord bot logged in as ${readyClient.user.tag}`);
      // Reset reconnect attempts when successfully connected
      reconnectAttempts = 0;

      // Initialize the QueueDisplayService
      try {
        const { QueueDisplayService } = await import('../bot/services/queueDisplayService');
        const { storage } = await import('../storage');
        const queueDisplayService = QueueDisplayService.getInstance(storage);
        
        // Force an initial refresh of the queue display with more reliable timing
        setTimeout(async () => {
          try {
            await queueDisplayService.refreshQueueDisplay();
            logger.info("Initial queue display refreshed successfully");
            
            // Double-check event emitter setup
            const { EventEmitter, QUEUE_EVENTS } = await import('../bot/utils/eventEmitter');
            const emitter = EventEmitter.getInstance();
            
            // Log event listener counts to verify they're registered
            logger.info(`Queue update listeners count: ${emitter.listenerCount(QUEUE_EVENTS.UPDATED)}`);
            
            // Set up a periodic refresh as a fallback mechanism
            setInterval(async () => {
              try {
                await queueDisplayService.refreshQueueDisplay();
                logger.debug("Periodic queue display refresh completed");
              } catch (refreshError) {
                logger.error(`Error in periodic queue display refresh: ${refreshError}`);
              }
            }, 30000); // Refresh every 30 seconds as a fallback (reduced from 60s)
          } catch (err) {
            logger.error(`Error refreshing initial queue display: ${err}`);
          }
        }, 5000); // Wait 5 seconds to ensure bot is fully ready
        
        logger.info("Queue display service initialized");
      } catch (error) {
        logger.error(`Error initializing queue display service: ${error}`, 
          error instanceof Error ? error.stack : 'No stack trace');
      }
    });

  // Handle disconnections
  discordClient.on(Events.Invalidated, () => {
    logger.warn('Discord client session invalidated');
    attemptReconnect();
  });

  discordClient.on(Events.ShardDisconnect, (closeEvent) => {
    logger.warn(`Discord client disconnected: ${closeEvent.reason || 'Unknown reason'}`);
    attemptReconnect();
  });

  discordClient.on(Events.ShardError, (error) => {
    logger.error(`Discord client error: ${error.message}`);
    attemptReconnect();
  });

  // Handle interaction events (slash commands)
  discordClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      // Try to get commands from the discord command collection first
      const discordCommands = getCommands();
      const discordCommand = discordCommands.get(interaction.commandName);

      // For TypeScript type checking, verify the command has an execute function
      if (discordCommand && typeof (discordCommand as any).execute === 'function') {
        await (discordCommand as any).execute(interaction);
        logger.info(`Discord command "${interaction.commandName}" executed by ${interaction.user.tag}`);
        return;
      }

      // If command not found in discord commands, check bot commands
      try {
        // Dynamic import to avoid circular dependencies
        const botCommands = await import('../bot/commands');
        const botCommand = botCommands.commands.find(cmd => cmd.data.name === interaction.commandName);

        if (botCommand && typeof botCommand.execute === 'function') {
          await botCommand.execute(interaction);
          logger.info(`Bot command "${interaction.commandName}" executed by ${interaction.user.tag}`);
          return;
        }
      } catch (importError) {
        logger.error('Error importing bot commands', { error: importError });
      }

      // No command found in either collection
      logger.warn(`Command "${interaction.commandName}" not found in command collections`);
    } catch (error) {
      logger.error('Error executing command', { error, command: interaction.commandName });

      const errorResponse = {
        content: 'There was an error while executing this command!',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    }
  });
}

// Attempt to reconnect to Discord
async function attemptReconnect() {
  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // If we've exceeded max attempts, give up
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error(`Failed to reconnect to Discord after ${MAX_RECONNECT_ATTEMPTS} attempts. Giving up.`);
    return;
  }

  reconnectAttempts++;
  logger.info(`Attempting to reconnect to Discord (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  // Schedule a reconnect attempt
  reconnectTimer = setTimeout(async () => {
    try {
      if (client) {
        // Destroy the current client first
        try {
          client.destroy();
        } catch (destroyError) {
          logger.error(`Error destroying old client: ${destroyError}`);
        }
      }

      // Create a new client
      client = createClient();
      setupEventHandlers(client);

      // Attempt to log in
      await client.login(process.env.DISCORD_TOKEN);
      logger.info('Discord bot reconnection successful');

      // Re-register commands
      await registerCommands();
      logger.info('Slash commands re-registered after reconnection');
    } catch (error) {
      logger.error(`Discord bot reconnection failed: ${error}`);

      // Schedule another attempt
      attemptReconnect();
    }
  }, RECONNECT_INTERVAL);
}

// Initialize the Discord bot
export async function initializeBot() {
  if (!process.env.DISCORD_TOKEN) {
    logger.error('DISCORD_TOKEN is required but not found in environment variables');
    throw new Error('DISCORD_TOKEN environment variable is required');
  }

  // Create the client if it doesn't exist
  if (!client) {
    client = createClient();
    setupEventHandlers(client);
  }

  // Login to Discord with your token
  try {
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('Discord bot login successful');

    // Register slash commands when bot is ready
    const botConfig = await storage.getBotConfig();
    await registerCommands();
    logger.info('Slash commands registered');

    // Start a periodic connection check
    startConnectionHealthCheck();
  } catch (error) {
    logger.error('Discord bot login failed', { error });
    throw error;
  }

  return client;
}

// Periodic connection health check
function startConnectionHealthCheck() {
  setInterval(() => {
    if (client && !client.isReady()) {
      logger.warn('Discord client health check: Client exists but is not ready');
      attemptReconnect();
    }
  }, 60000); // Check every minute
}

// Get the Discord client, with validation
export function getDiscordClient() {
  // Only return the client if it's ready and authenticated
  if (client && client.isReady()) {
    return client;
  }

  // If client isn't ready, log this and trigger reconnection
  logger.warn('Discord client is not ready or authenticated yet');
  attemptReconnect();
  return null;
}