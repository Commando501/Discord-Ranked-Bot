import { Client, Events, GatewayIntentBits } from 'discord.js';
import config from '../config';
import { logger } from '../utils/logger';
import { registerCommands, getCommands } from './commands';

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
      const commands = getCommands();
      const command = commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Command "${interaction.commandName}" not found`);
        return;
      }

      await command.execute(interaction);
      logger.info(`Command "${interaction.commandName}" executed by ${interaction.user.tag}`);
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
    if (config.registerCommandsOnStartup) {
      await registerCommands();
      logger.info('Slash commands registered');
    }
  } catch (error) {
    logger.error('Discord bot login failed', { error });
    throw error;
  }

  return client;
}

export function getDiscordClient() {
  return client;
}
