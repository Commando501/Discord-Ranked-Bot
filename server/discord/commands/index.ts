import { REST, Routes, Collection } from 'discord.js';
import { logger } from '../../bot/utils/logger';
import { storage } from '../../storage';

// Import our local commands
import * as queueCommand from './queue';
import * as leaveCommand from './leave';
import * as listCommand from './list';
import * as profileCommand from './profile';
import * as configCommand from './config';
import * as adminQueueCommand from './adminqueue';
import * as leaderboardCommand from './leaderboard';
import * as helpCommand from './help';
// Match and admin commands are implemented directly in server/bot/commands.ts

// Create a collection of all commands
const commands = new Collection();

// Add all commands to the collection
commands.set(queueCommand.data.name, queueCommand);
commands.set(leaveCommand.data.name, leaveCommand);
commands.set(listCommand.data.name, listCommand);
commands.set(profileCommand.data.name, profileCommand);
commands.set(configCommand.data.name, configCommand);
commands.set(adminQueueCommand.data.name, adminQueueCommand);
commands.set(leaderboardCommand.data.name, leaderboardCommand);
commands.set(helpCommand.data.name, helpCommand);
// Match and admin commands are accessed through server/bot/commands.ts

// Get all slash command data for registration without immediate dependency on bot/commands
const commandsData = [
  queueCommand.data.toJSON(),
  leaveCommand.data.toJSON(),
  listCommand.data.toJSON(),
  profileCommand.data.toJSON(),
  configCommand.data.toJSON(),
  adminQueueCommand.data.toJSON(),
  leaderboardCommand.data.toJSON(),
  helpCommand.data.toJSON()
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

    // Now that we're in the function, we can safely import bot commands
    // This avoids the circular dependency issue
    const botCommands = await import('../../bot/commands');
    
    // Get the names of local commands to avoid duplication
    const localCommandNames = commandsData.map(cmd => cmd.name);
    
    // Filter bot commands to only include those not already in local commands
    const filteredBotCommands = botCommands.commands
      .filter(cmd => !localCommandNames.includes(cmd.data.name))
      .map(cmd => cmd.data.toJSON());
    
    // Create combined command data with both local and filtered bot commands
    const allCommandsData = [
      ...commandsData,
      ...filteredBotCommands
    ];
    
    logger.info(`Registering ${commandsData.length} local commands and ${filteredBotCommands.length} additional bot commands`);

    // Fetch the bot configuration from storage
    const botConfig = await storage.getBotConfig();
    
    // If guild ID is provided, register commands for specific guild (faster for testing)
    if (botConfig.general.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, botConfig.general.guildId),
        { body: allCommandsData },
      );
      logger.info(`Successfully registered commands for guild ID: ${botConfig.general.guildId}`);
    } else {
      // Register commands globally (takes up to an hour to propagate)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: allCommandsData },
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
