import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { logger } from '../../bot/utils/logger';
import { QueueService } from '../../bot/services/queueService';
import { PlayerService } from '../../bot/services/playerService';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Join the matchmaking queue');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  try {
    // Get the player service
    const playerService = new PlayerService(storage);
    
    // Get or create player
    const player = await playerService.getOrCreatePlayer({
      id: interaction.user.id,
      username: interaction.user.tag,
      discriminator: '',
      avatar: null
    });
    
    // Get the queue service
    const queueService = new QueueService(storage);
    
    // Check if player is already in queue
    const existingQueueEntry = await queueService.getPlayerQueueEntry(player.id);
    
    if (existingQueueEntry) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245') // Discord red
        .setTitle('Already in Queue')
        .setDescription('You are already in the matchmaking queue.')
        .addFields({ name: 'Queue Position', value: `You joined <t:${Math.floor(existingQueueEntry.joinedAt.getTime() / 1000)}:R>` })
        .setFooter({ text: 'Use /leave to leave the queue' });
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Add player to queue
    await queueService.addPlayerToQueue(player.id);
    
    // Get updated queue count
    const queueCount = (await queueService.getAllQueueEntries()).length;
    
    // Create response embed
    const embed = new EmbedBuilder()
      .setColor('#57F287') // Discord green
      .setTitle('Joined Queue')
      .setDescription(`You have been added to the matchmaking queue!`)
      .addFields(
        { name: 'Current Queue Size', value: `${queueCount} players`, inline: true },
        { name: 'Your MMR', value: `${player.mmr}`, inline: true }
      )
      .setFooter({ text: 'Use /leave to leave the queue' });
    
    await interaction.editReply({ embeds: [embed] });
    
    // Check if we have enough players to create a match
    if (interaction.guild) {
      const canCreateMatch = await queueService.checkAndCreateMatch(interaction.guild);
      
      if (canCreateMatch) {
        logger.info('Enough players in queue, creating match');
        // This will be handled by the QueueService
        // which will notify players about the new match
      }
    } else {
      logger.warn('Unable to create match: interaction.guild is null');
    }
    
  } catch (error) {
    logger.error('Error executing queue command', { error, userId: interaction.user.id });
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Error')
      .setDescription('There was an error adding you to the queue. Please try again later.');
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
