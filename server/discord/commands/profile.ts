import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, User } from 'discord.js';
import { storage } from '../../storage';
import { logger } from '../../utils/logger';
import { PlayerService } from '../../services/playerService';
import { MatchService } from '../../services/matchService';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View your or another player\'s profile and statistics')
  .addAliases(['p', 'stats'])
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user whose profile you want to view')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  try {
    // Get the target user
    const targetUser: User = interaction.options.getUser('user') || interaction.user;
    
    // Get services
    const playerService = new PlayerService(storage);
    const matchService = new MatchService(storage);
    
    // Get player data
    const player = await playerService.getPlayerByDiscordId(targetUser.id);
    
    if (!player) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245') // Discord red
        .setTitle('Profile Not Found')
        .setDescription(`${targetUser.tag} has not played any matches yet.`);
      
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Calculate win rate
    const totalGames = player.wins + player.losses;
    const winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
    
    // Get recent match results
    const matchResults = await matchService.getPlayerMatchResults(player.id, 5);
    
    // Create profile embed
    const embed = new EmbedBuilder()
      .setColor('#5865F2') // Discord blurple
      .setTitle(`${targetUser.username}'s Profile`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'MMR Rating', value: `${player.mmr}`, inline: true },
        { name: 'Win/Loss', value: `${player.wins}W / ${player.losses}L`, inline: true },
        { name: 'Win Rate', value: `${winRate}%`, inline: true },
        { name: 'Current Streak', value: getStreakText(player.winStreak, player.lossStreak), inline: true }
      );
    
    // Add match history if available
    if (matchResults.length > 0) {
      let historyText = '';
      
      for (const result of matchResults) {
        const icon = result.won ? '🟢 Win' : '🔴 Loss';
        const mmrChange = result.mmrChange > 0 ? `+${result.mmrChange}` : result.mmrChange;
        historyText += `${icon} | Match #${result.matchId} | MMR: ${mmrChange}\n`;
      }
      
      embed.addFields({ name: 'Recent Matches', value: historyText });
    } else {
      embed.addFields({ name: 'Recent Matches', value: 'No recent matches' });
    }
    
    embed.setFooter({ text: `Player since ${player.createdAt.toLocaleDateString()}` });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error('Error executing profile command', { error, userId: interaction.user.id });
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Error')
      .setDescription('There was an error retrieving the profile information. Please try again later.');
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

function getStreakText(winStreak: number, lossStreak: number): string {
  if (winStreak > 0) {
    return `${winStreak} wins 🔥`;
  } else if (lossStreak > 0) {
    return `${lossStreak} losses 💔`;
  } else {
    return 'No streak';
  }
}
