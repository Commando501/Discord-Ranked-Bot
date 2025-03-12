import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { logger } from '../../utils/logger';
import { QueueService } from '../../services/queueService';
import { PlayerService } from '../../services/playerService';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Leave the matchmaking queue')
  .addAliases(['r', 'remove']);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  try {
    // Get services
    const playerService = new PlayerService(storage);
    const queueService = new QueueService(storage);
    
    // Get player
    const player = await playerService.getPlayerByDiscordId(interaction.user.id);
    
    if (!player) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245') // Discord red
        .setTitle('Not Registered')
        .setDescription('You are not registered in our system. Use `/queue` to join the queue and register.');
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Check if player is in queue
    const queueEntry = await queueService.getPlayerQueueEntry(player.id);
    
    if (!queueEntry) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245') // Discord red
        .setTitle('Not in Queue')
        .setDescription('You are not currently in the matchmaking queue.');
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Remove player from queue
    await queueService.removePlayerFromQueue(player.id);
    
    // Get updated queue count
    const queueCount = (await queueService.getAllQueueEntries()).length;
    
    // Create response embed
    const embed = new EmbedBuilder()
      .setColor('#5865F2') // Discord blurple
      .setTitle('Left Queue')
      .setDescription(`You have been removed from the matchmaking queue.`)
      .addFields(
        { name: 'Current Queue Size', value: `${queueCount} players`, inline: true }
      )
      .setFooter({ text: 'Use /queue to rejoin the queue' });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Error executing leave command', { error, userId: interaction.user.id });
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Error')
      .setDescription('There was an error removing you from the queue. Please try again later.');
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
