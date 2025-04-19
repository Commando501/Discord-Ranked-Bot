
import { ButtonInteraction } from "discord.js";
import { storage } from "../../storage";
import { QueueService } from "../../bot/services/queueService";
import { PlayerService } from "../../bot/services/playerService";
import { logger } from "../../bot/utils/logger";

/**
 * Handles button interactions for the Discord bot
 */
export async function handleButtonInteraction(interaction: ButtonInteraction) {
  // Handle queue join button
  if (interaction.customId === 'queue_join') {
    await handleQueueJoin(interaction);
  }
  
  // Handle queue leave button
  if (interaction.customId === 'queue_leave') {
    await handleQueueLeave(interaction);
  }
}

/**
 * Handle join queue button press
 */
async function handleQueueJoin(interaction: ButtonInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get services
    const playerService = new PlayerService(storage);
    const queueService = new QueueService(storage);
    
    // Get or create player
    const player = await playerService.getOrCreatePlayer({
      id: interaction.user.id,
      username: interaction.user.tag,
      discriminator: '',
      avatar: null
    });
    
    // Check if player is already in queue
    const existingQueueEntry = await queueService.getPlayerQueueEntry(player.id);
    
    if (existingQueueEntry) {
      return interaction.editReply('You are already in the matchmaking queue.');
    }
    
    // Add player to queue
    const queueResult = await queueService.addPlayerToQueue(player.id);
    
    if (!queueResult.success) {
      return interaction.editReply(`Error joining queue: ${queueResult.message}`);
    }
    
    // Get updated queue count
    const queueCount = (await queueService.getAllQueueEntries()).length;
    
    await interaction.editReply(`✅ You have been added to the queue! Current queue size: ${queueCount} players.`);
    
    // Check if we have enough players to create a match
    if (interaction.guild) {
      const canCreateMatch = await queueService.checkAndCreateMatch(interaction.guild);
      
      if (canCreateMatch) {
        logger.info('Enough players in queue, creating match');
      }
    }
  } catch (error) {
    logger.error('Error handling queue join button', { error, userId: interaction.user.id });
    await interaction.editReply('There was an error adding you to the queue. Please try again later.');
  }
}

/**
 * Handle leave queue button press
 */
async function handleQueueLeave(interaction: ButtonInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get services
    const playerService = new PlayerService(storage);
    const queueService = new QueueService(storage);
    
    // Get player
    const player = await playerService.getPlayerByDiscordId(interaction.user.id);
    
    if (!player) {
      return interaction.editReply('You are not registered in our system.');
    }
    
    // Check if player is in queue
    const queueEntry = await queueService.getPlayerQueueEntry(player.id);
    
    if (!queueEntry) {
      return interaction.editReply('You are not currently in the matchmaking queue.');
    }
    
    // Remove player from queue
    await queueService.removePlayerFromQueue(player.id);
    
    // Get updated queue count
    const queueCount = (await queueService.getAllQueueEntries()).length;
    
    await interaction.editReply(`✅ You have been removed from the queue. Current queue size: ${queueCount} players.`);
    
  } catch (error) {
    logger.error('Error handling queue leave button', { error, userId: interaction.user.id });
    await interaction.editReply('There was an error removing you from the queue. Please try again later.');
  }
}
