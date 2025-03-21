import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { logger } from '../../bot/utils/logger';
import { QueueService } from '../../bot/services/queueService';
import { MatchService } from '../../bot/services/matchService';
import { PlayerService } from '../../bot/services/playerService';
import { formatDuration } from '../../bot/utils/helpers';

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
      .setTitle('Active Matches');
    
    if (activeMatches.length > 0) {
      for (const match of activeMatches) {
        const matchDescription = `Status: ${match.status}\nTeam A vs Team B\nStarted: ${formatDuration(match.createdAt)}`;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  try {
    // Get services
    const queueService = new QueueService(storage);
    const matchService = new MatchService(storage);
    const playerService = new PlayerService(storage);
    
    // Get all queue entries
    const queueEntries = await queueService.getAllQueueEntries();
    
    // Get all active matches
    const activeMatches = await matchService.getActiveMatches();
    
    // Create queue embed
    const queueEmbed = new EmbedBuilder()
      .setColor('#5865F2') // Discord blurple
      .setTitle('Matchmaking Queue')
      .setDescription(queueEntries.length === 0 ? 'No players in queue' : `${queueEntries.length} players in queue`);
    
    if (queueEntries.length > 0) {
      // Sort queue entries by join time (oldest first)
      queueEntries.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
      
      // Get player details for each queue entry
      const queueDetails: { username: string; mmr: number; waitTime: string }[] = [];
      
      for (const entry of queueEntries) {
        const player = await playerService.getPlayerById(entry.playerId);
        if (player) {
          const waitTime = formatDuration(new Date().getTime() - entry.joinedAt.getTime());
          queueDetails.push({
            username: player.discordUsername,
            mmr: player.mmr,
            waitTime
          });
        }
      }
      
      // Add queue details to embed
      let queueList = '';
      for (let i = 0; i < queueDetails.length; i++) {
        const { username, mmr, waitTime } = queueDetails[i];
        queueList += `${i + 1}. **${username}** (MMR: ${mmr}) - waiting for ${waitTime}\n`;
      }
      
      queueEmbed.addFields({ name: 'Players', value: queueList });
    }
    
    // Create active matches embed
    const matchesEmbed = new EmbedBuilder()
      .setColor('#57F287') // Discord green
      .setTitle('Active Matches')
      .setDescription(activeMatches.length === 0 ? 'No active matches' : `${activeMatches.length} active matches`);
    
    if (activeMatches.length > 0) {
      for (let i = 0; i < activeMatches.length; i++) {
        const match = activeMatches[i];
        // Get teams directly from the activeMatches response since it already includes team data
        const teams = match.teams || [];
        
        if (teams.length > 0) {
          const matchDuration = formatDuration(new Date().getTime() - match.createdAt.getTime());
          let matchDescription = `**Status:** ${match.status}\n**Duration:** ${matchDuration}\n\n`;
          
          for (const team of teams) {
            const teamName = team.name || `Team ${i+1}`;
            matchDescription += `**${teamName}** (Avg MMR: ${team.avgMMR || 'N/A'}):\n`;
            
            for (const player of team.players || []) {
              matchDescription += `• ${player.username} (MMR: ${player.mmr})\n`;
            }
            
            matchDescription += '\n';
          }
          
          matchesEmbed.addFields({ 
            name: `Match #${match.id}`, 
            value: matchDescription
          });
        }
      }
    }
    
    // Send both embeds
    await interaction.editReply({ embeds: [queueEmbed, matchesEmbed] });
    
  } catch (error) {
    logger.error('Error executing list command', { error, userId: interaction.user.id });
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Error')
      .setDescription('There was an error retrieving the queue and match information. Please try again later.');
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
