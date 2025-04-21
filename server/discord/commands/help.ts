
import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../../bot/utils/logger';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Shows all available bot commands and their usage');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('Bot Commands')
      .setColor('#5865F2')
      .setDescription('Here are all available commands for the bot:')
      .addFields(
        { name: '/queue', value: 'Join the matchmaking queue', inline: true },
        { name: '/leave', value: 'Leave the matchmaking queue', inline: true },
        { name: '/list', value: 'View current queue and matches', inline: true },
        { name: '/profile', value: 'View player statistics (usage: /profile [user])', inline: true },
        { name: '/config', value: 'View bot configuration settings', inline: true },
        { name: '/leaderboard', value: 'View the ranked leaderboard of players', inline: true },
        { name: '/history', value: 'View match history (usage: /history [user] [count])', inline: true },
        { name: '/streak', value: 'View win/loss streak (usage: /streak [user])', inline: true },
        { name: '/votekick', value: 'Vote to kick a player from a match (usage: /votekick @user)', inline: true }
      )
      .setFooter({ text: 'Use each command to see more details about its usage' });

    const adminEmbed = new EmbedBuilder()
      .setTitle('Admin Commands')
      .setColor('#ED4245')
      .setDescription('These commands are only available to administrators:')
      .addFields(
        { name: '/adminqueue', value: 'Admin queue management commands', inline: true },
        { name: '/forcematch', value: 'Admin: Force create a match (usage: /forcematch @user1 @user2...)', inline: true },
        { name: '/endmatch', value: 'Admin: End a match and record results (usage: /endmatch <match_id> <winning_team>)', inline: true },
        { name: '/resetqueue', value: 'Admin: Reset the queue (usage: /resetqueue)', inline: true }
      )
      .setFooter({ text: 'Admin commands require proper permissions' });

    await interaction.reply({ embeds: [embed, adminEmbed] });
    
    logger.info(`Help command executed by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error executing help command', { error, userId: interaction.user.id });
    
    await interaction.reply({ 
      content: 'There was an error displaying the help information. Please try again later.',
      ephemeral: true 
    });
  }
}
