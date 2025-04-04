
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { QueueService } from '../../bot/services/queueService';
import { MatchService } from '../../bot/services/matchService';
import { storage } from '../../storage';
import { formatDuration } from '../../bot/utils/timeUtils';
import { logger } from '../../bot/utils/logger';

export const data = new SlashCommandBuilder()
  .setName('list')
  .setDescription('List players in the queue and active matches');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  try {
    const queueService = new QueueService(storage);
    const matchService = new MatchService(storage);
    
    // Get queue and match data
    const queuePlayers = await queueService.getQueuePlayersWithInfo();
    const activeMatches = await matchService.getActiveMatches();
    
    // Create queue embed
    const queueEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Matchmaking Queue')
      .setDescription(`${queuePlayers.length} players in queue`);
    
    if (queuePlayers.length > 0) {
      const queueList = queuePlayers
        .map((entry, index) => {
          const waitTime = formatDuration(entry.joinedAt);
          return `${index + 1}. ${entry.player.username} (MMR: ${entry.player.mmr}) - waiting for ${waitTime}`;
        })
        .join('\n');
      
      queueEmbed.addFields({ name: 'Players', value: queueList });
    }
    
    // Create matches embed
    const matchesEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Active Matches')
      .setDescription(activeMatches.length > 0 
        ? `${activeMatches.length} active matches`
        : 'No active matches');

    // If there are active matches, fetch detailed information for each
    if (activeMatches.length > 0) {
      // Create a separate embed for each match with detailed information
      const matchEmbeds = await Promise.all(activeMatches.map(async (match) => {
        try {
          // Get detailed match information including teams
          const matchDetails = await matchService.getMatchDetails(match.id);
          
          // Calculate match duration
          const matchDuration = formatDuration(match.createdAt);
          
          // Create embed for this match
          const matchEmbed = new EmbedBuilder()
            .setColor('#3BA55C')
            .setTitle(`Match #${match.id}`)
            .setDescription(`Status: ${match.status} | Started: ${matchDuration} ago`)
            .setFooter({ text: `Use /endmatch ${match.id} Eagle|Cobra to end this match` });
          
          // Add team information if available
          if (matchDetails?.teams && matchDetails.teams.length > 0) {
            matchDetails.teams.forEach(team => {
              const teamPlayers = team.players.map(player => 
                `${player.username} (MMR: ${player.mmr})`
              ).join('\n');
              
              matchEmbed.addFields({
                name: `Team ${team.name} (Avg MMR: ${team.avgMMR})`,
                value: teamPlayers || 'No players',
                inline: true
              });
            });
            
            // Add channel information if available
            if (matchDetails.channelId) {
              matchEmbed.addFields({
                name: 'Match Channel',
                value: `<#${matchDetails.channelId}>`,
                inline: false
              });
            }
          }
          
          return matchEmbed;
        } catch (detailError) {
          logger.error(`Error fetching details for match ${match.id}:`, detailError);
          // Fallback to simple match embed if details can't be fetched
          return new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle(`Match #${match.id}`)
            .setDescription(`Status: ${match.status}\nStarted: ${formatDuration(match.createdAt)}\n⚠️ Could not load detailed information`);
        }
      }));
      
      // Send queue embed first, then all match embeds
      await interaction.editReply({ 
        embeds: [queueEmbed, ...matchEmbeds]
      });
    } else {
      // If no matches, just send the queue embed and empty matches embed
      await interaction.editReply({ embeds: [queueEmbed, matchesEmbed] });
    }
  } catch (error) {
    logger.error(`Error in list command:`, error);
    await interaction.editReply('An error occurred while fetching the queue and match information.');
  }
}
