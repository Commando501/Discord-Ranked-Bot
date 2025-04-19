import { Client, Collection, Events, GatewayIntentBits, REST, Routes, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../bot/utils/logger';
import * as commandModules from './commands';
import { handleButtonInteraction } from './events/buttonInteractions'; // Assuming this file will be created
import { storage } from '../storage';
import { config } from '../bot/config';

let commands: any = [];
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const commandsCollection = new Collection(); // Initialize commands collection

// Populate commandsCollection (This assumes a structure for command modules)
for (const module of Object.values(commandModules)) {
  if (module.default && module.default.data) {
    commandsCollection.set(module.default.data.name, module.default);
  }
}


client.on(Events.InteractionCreate, async (interaction) => {
    // Handle button interactions
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    // Handle slash commands
    if (!interaction.isChatInputCommand()) return;

    try {
      const commandName = interaction.commandName;

      // Handle command if it exists
      if (commandsCollection.has(commandName)) {
        await commandsCollection.get(commandName).execute(interaction);
        logger.info(`Discord command "${commandName}" executed by ${interaction.user.tag}`);
      } else {
        logger.warn(`Unknown command: ${commandName}`);
        await interaction.reply('Unknown command');
      }
    } catch (error) {
      logger.error('Discord command error:', error);

      const replyContent = {
        content: 'There was an error executing this command.',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyContent);
      } else {
        await interaction.reply(replyContent);
      }
    }
  });


// ... rest of the original file (excluding the interaction handler) remains here ...

//  Example implementation of handleButtonInteraction in './events/buttonInteractions.ts'

// import { ButtonInteraction } from 'discord.js';
// import { QueueManager } from '../queueManager'; // Assuming a queue manager exists

// export async function handleButtonInteraction(interaction: ButtonInteraction) {
//   if (!interaction.isButton()) return;

//   const queueManager = new QueueManager(); // Initialize queue manager

//   try {
//     if (interaction.customId === 'joinQueue') {
//       await queueManager.joinQueue(interaction.user, interaction.guild);
//       await interaction.reply({ content: 'Joined the queue!', ephemeral: true });
//     } else if (interaction.customId === 'leaveQueue') {
//       await queueManager.leaveQueue(interaction.user, interaction.guild);
//       await interaction.reply({ content: 'Left the queue!', ephemeral: true });
//     } else {
//       await interaction.reply({ content: 'Unknown button interaction', ephemeral: true });
//     }
//   } catch (error) {
//     console.error('Error handling button interaction:', error);
//     await interaction.reply({ content: 'An error occurred.', ephemeral: true });
//   }
// }