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
      // First try the discord command collection
      const discordCommands = getCommands();
      const discordCommand = discordCommands.get(interaction.commandName);

      if (discordCommand && discordCommand.execute) {
        await discordCommand.execute(interaction);
        logger.info(`Discord command "${interaction.commandName}" executed by ${interaction.user.tag}`);
        return;
      }
      
      // If not found in discord commands, check in bot commands
      if (Array.isArray(botCommands.commands)) {
        const botCommand = botCommands.commands.find(cmd => cmd.data.name === interaction.commandName);
        if (botCommand && botCommand.execute) {
          await botCommand.execute(interaction);
          logger.info(`Bot command "${interaction.commandName}" executed by ${interaction.user.tag}`);
          return;
        }
      }

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
  return client;
}
