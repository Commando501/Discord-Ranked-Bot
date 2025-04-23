
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { logger } from '../../bot/utils/logger';
import { QueueService } from '../../bot/services/queueService';
import { PlayerService } from '../../bot/services/playerService';
import { MatchService } from '../../bot/services/matchService';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Leave the matchmaking queue or current match');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  try {
    // Get services
    const playerService = new PlayerService(storage);
    const queueService = new QueueService(storage);
    const matchService = new MatchService(storage);
    
    // Get player
    const player = await playerService.getPlayerByDiscordId(interaction.user.id);
    
    if (!player) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245') // Discord red
        .setTitle('Not Registered')
        .setDescription('You are not registered in our system. Use `/queue` to join the queue and register.');
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    // First check if player is in an active match
    const isInMatch = await queueService.isPlayerInActiveMatch(player.id);
    
    if (isInMatch) {
      // Find the match the player is in
      const activeMatches = await matchService.getActiveMatches();
      let playerMatch = null;
      let playerTeam = null;
      
      // Find which match and team the player is in
      for (const match of activeMatches) {
        for (const team of match.teams) {
          const isInTeam = team.players.some(p => p.id === player.id);
          if (isInTeam) {
            playerMatch = match;
            playerTeam = team;
            break;
          }
        }
        if (playerMatch) break;
      }
      
      if (playerMatch) {
        // Use the handleMatchCancellationWithExclusion method to cancel the match
        // This will prevent the leaving player from being added back to the queue
        const result = await matchService.handleMatchCancellationWithExclusion(
          playerMatch.id, 
          player.id
        );
        
        if (result.success) {
          const embed = new EmbedBuilder()
            .setColor('#5865F2') // Discord blurple
            .setTitle('Left Match')
            .setDescription(`You have left match #${playerMatch.id}. The match has been cancelled and other players returned to queue.`)
            .setFooter({ text: 'Use /queue to join a new match' });
          
          await interaction.editReply({ embeds: [embed] });
        } else {
          const embed = new EmbedBuilder()
            .setColor('#ED4245') // Discord red
            .setTitle('Error')
            .setDescription(`Failed to leave match: ${result.message}`);
          
          await interaction.editReply({ embeds: [embed] });
        }
        
        return;
      }
    }
    
    // If not in match, check if player is in queue
    const queueEntry = await queueService.getPlayerQueueEntry(player.id);
    
    if (!queueEntry) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245') // Discord red
        .setTitle('Not in Queue or Match')
        .setDescription('You are not currently in the matchmaking queue or an active match.');
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Remove player from queue
    // (this will emit the queue:updated event internally)
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
      .setDescription('There was an error processing your request. Please try again later.');
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
