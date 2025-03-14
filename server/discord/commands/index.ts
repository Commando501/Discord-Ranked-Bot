import { REST, Routes, Collection } from 'discord.js';
import { logger } from '../../bot/utils/logger';
import { storage } from '../../storage';

import * as queueCommand from './queue';
import * as leaveCommand from './leave';
import * as listCommand from './list';
import * as profileCommand from './profile';
import * as configCommand from './config';
import * as matchCommands from './match';
import * as adminCommands from './admin';

// Create a collection of all commands
const commands = new Collection();

// Add all commands to the collection
commands.set(queueCommand.data.name, queueCommand);
commands.set(leaveCommand.data.name, leaveCommand);
commands.set(listCommand.data.name, listCommand);
commands.set(profileCommand.data.name, profileCommand);
commands.set(configCommand.data.name, configCommand);
commands.set(matchCommands.forcematchCommand.data.name, matchCommands.forcematchCommand);
commands.set(matchCommands.endmatchCommand.data.name, matchCommands.endmatchCommand);
commands.set(matchCommands.votekickCommand.data.name, matchCommands.votekickCommand);
commands.set(adminCommands.resetqueueCommand.data.name, adminCommands.resetqueueCommand);
commands.set(adminCommands.resetdataCommand.data.name, adminCommands.resetdataCommand);
commands.set(adminCommands.dummyCommand.data.name, adminCommands.dummyCommand);
commands.set(adminCommands.matchtimerCommand.data.name, adminCommands.matchtimerCommand);
commands.set(adminCommands.togglevoiceCommand.data.name, adminCommands.togglevoiceCommand);

// Get all slash command data for registration
const commandsData = [
  queueCommand.data.toJSON(),
  leaveCommand.data.toJSON(),
  listCommand.data.toJSON(),
  profileCommand.data.toJSON(),
  configCommand.data.toJSON(),
  matchCommands.forcematchCommand.data.toJSON(),
  matchCommands.endmatchCommand.data.toJSON(),
  matchCommands.votekickCommand.data.toJSON(),
  adminCommands.resetqueueCommand.data.toJSON(),
  adminCommands.resetdataCommand.data.toJSON(),
  adminCommands.dummyCommand.data.toJSON(),
  adminCommands.matchtimerCommand.data.toJSON(),
  adminCommands.togglevoiceCommand.data.toJSON(),
];

// Function to register commands with Discord API
export async function registerCommands() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN environment variable is missing');
  }
  
  if (!process.env.CLIENT_ID) {
    throw new Error('CLIENT_ID environment variable is missing');
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');

    // Fetch the bot configuration from storage
    const botConfig = await storage.getBotConfig();
    
    // If guild ID is provided, register commands for specific guild (faster for testing)
    if (botConfig.general.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, botConfig.general.guildId),
        { body: commandsData },
      );
      logger.info(`Successfully registered commands for guild ID: ${botConfig.general.guildId}`);
    } else {
      // Register commands globally (takes up to an hour to propagate)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandsData },
      );
      logger.info('Successfully registered commands globally');
    }
  } catch (error) {
    logger.error('Failed to register slash commands', { error });
    throw error;
  }
}

// Export the commands collection for use in bot.ts
export function getCommands() {
  return commands;
}
