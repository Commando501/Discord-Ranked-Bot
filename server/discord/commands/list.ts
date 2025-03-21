import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommandBuilder } from '@discord.js/builders';
import { QueueService } from '../../bot/services/queueService';
import { MatchService } from '../../bot/services/matchService';
import { storage } from '../../storage';
import { formatDuration } from '../../bot/utils/timeUtils';

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

    if (activeMatches.length > 0) {
      for (const match of activeMatches) {
        const matchDescription = `Status: ${match.status}\nTeam A vs Team B\nStarted: ${formatDuration(match.createdAt)}`;
        matchesEmbed.addFields({ 
          name: `Match #${match.id}`, 
          value: matchDescription 
        });
      }
    }

    await interaction.editReply({ embeds: [queueEmbed, matchesEmbed] });
  } catch (error) {
    console.error('Error in list command:', error);
    await interaction.editReply('An error occurred while fetching the queue and match information.');
  }
}