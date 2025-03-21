import { Client, Events, GatewayIntentBits, Collection } from 'discord.js';
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
  });
}

// Setup event handlers for the client
function setupEventHandlers(discordClient: Client) {
  // Client ready event
  discordClient.on(Events.ClientReady, (readyClient) => {
    logger.info(`Discord bot logged in as ${readyClient.user.tag}`);
    // Reset reconnect attempts when successfully connected
    reconnectAttempts = 0;
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
      // Try to get commands from the discord command collection
      const discordCommands = getCommands();
      const discordCommand = discordCommands.get(interaction.commandName);

      if (discordCommand && typeof discordCommand.execute === 'function') {
        await discordCommand.execute(interaction);
        logger.info(`Discord command "${interaction.commandName}" executed by ${interaction.user.tag}`);
        return;
      }
      
      // We don't need to check bot commands here since they're all registered in discord commands

      // No command found
      logger.warn(`Command "${interaction.commandName}" not found in command collection`);
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
