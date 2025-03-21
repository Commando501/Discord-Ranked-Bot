import { Client, Events, GatewayIntentBits, Collection } from 'discord.js';
import { logger } from '../bot/utils/logger';
import { registerCommands, getCommands } from './commands';
import { storage } from '../storage';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

export async function initializeBot() {
  if (!process.env.DISCORD_TOKEN) {
    logger.error('DISCORD_TOKEN is required but not found in environment variables');
    throw new Error('DISCORD_TOKEN environment variable is required');
  }

  // Client ready event
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Discord bot logged in as ${readyClient.user.tag}`);
  });

  // Handle interaction events (slash commands)
  client.on(Events.InteractionCreate, async (interaction) => {
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
      logger.warn(`Command "${interaction.commandName}" not found in either command collection`);
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

  // Login to Discord with your token
  try {
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('Discord bot login successful');
    
    // Register slash commands when bot is ready
    const botConfig = await storage.getBotConfig();
    await registerCommands();
    logger.info('Slash commands registered');
  } catch (error) {
    logger.error('Discord bot login failed', { error });
    throw error;
  }

  return client;
}

export function getDiscordClient() {
  // Only return the client if it's ready and authenticated
  if (client && client.isReady()) {
    return client;
  }
  
  // If client isn't ready, log this and return null
  logger.warn('Discord client is not ready or authenticated yet');
  return null;
}
