import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { storage } from '../../storage';
import { logger } from '../../bot/utils/logger';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Shows the current bot configuration')
  .addSubcommand(subcommand =>
    subcommand
      .setName('matchmaking')
      .setDescription('Shows matchmaking configuration')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('mmr')
      .setDescription('Shows MMR system configuration')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('rules')
      .setDescription('Shows match rules configuration')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const subcommand = interaction.options.getSubcommand();
    const botConfig = await storage.getBotConfig();
    
    if (subcommand === 'matchmaking') {
      const embed = new EmbedBuilder()
        .setTitle('Matchmaking Configuration')
        .setColor('#5865F2')
        .addFields(
          { 
            name: 'Queue Size Limits', 
            value: `Min: ${botConfig.matchmaking.queueSizeLimits.min}\nMax: ${botConfig.matchmaking.queueSizeLimits.max}`,
            inline: true 
          },
          { 
            name: 'Auto Match Creation', 
            value: botConfig.matchmaking.autoMatchCreation ? 'Enabled' : 'Disabled',
            inline: true 
          },
          { 
            name: 'Creation Interval', 
            value: `${botConfig.matchmaking.matchCreationIntervalSeconds} seconds`,
            inline: true 
          },
          { 
            name: 'Queue Timeout', 
            value: `${botConfig.matchmaking.queueTimeoutMinutes} minutes`,
            inline: true 
          },
          { 
            name: 'Min Players Per Team', 
            value: botConfig.matchmaking.minPlayersPerTeam.toString(),
            inline: true 
          },
          { 
            name: 'Team Balance Method', 
            value: botConfig.matchmaking.teamBalanceMethod,
            inline: true 
          }
        )
        .setFooter({ text: 'Current configuration' });
      
      await interaction.reply({ embeds: [embed] });
    } 
    else if (subcommand === 'mmr') {
      const embed = new EmbedBuilder()
        .setTitle('MMR System Configuration')
        .setColor('#5865F2')
        .addFields(
          { 
            name: 'Starting MMR', 
            value: botConfig.mmrSystem.startingMmr.toString(),
            inline: true 
          },
          { 
            name: 'K-Factor', 
            value: botConfig.mmrSystem.kFactor.toString(),
            inline: true 
          },
          { 
            name: 'Calculation Method', 
            value: botConfig.mmrSystem.mmrCalculationMethod,
            inline: true 
          },
          { 
            name: 'Placement Matches', 
            value: botConfig.mmrSystem.placementMatches.toString(),
            inline: true 
          },
          { 
            name: 'MMR Range Restrictions', 
            value: botConfig.mmrSystem.mmrRangeRestrictions ? 'Enabled' : 'Disabled',
            inline: true 
          },
          { 
            name: 'Max MMR Difference', 
            value: botConfig.mmrSystem.maxMmrDifference.toString(),
            inline: true 
          }
        )
        .setFooter({ text: 'Current configuration' });
      
      await interaction.reply({ embeds: [embed] });
    }
    else if (subcommand === 'rules') {
      const embed = new EmbedBuilder()
        .setTitle('Match Rules Configuration')
        .setColor('#5865F2')
        .addFields(
          { 
            name: 'Vote Majority %', 
            value: `${botConfig.matchRules.voteSystemSettings.majorityPercent}%`,
            inline: true 
          },
          { 
            name: 'Min Votes Needed', 
            value: botConfig.matchRules.voteSystemSettings.minVotesNeeded.toString(),
            inline: true 
          },
          { 
            name: 'Match Time Limit', 
            value: `${botConfig.matchRules.matchTimeLimitHours} hours`,
            inline: true 
          },
          { 
            name: 'Forfeit', 
            value: botConfig.matchRules.enableForfeit ? 'Enabled' : 'Disabled',
            inline: true 
          },
          { 
            name: 'No-Show Timeout', 
            value: `${botConfig.matchRules.noShowTimeoutMinutes} minutes`,
            inline: true 
          },
          { 
            name: 'Min Players to Start', 
            value: botConfig.matchRules.minPlayersToStart.toString(),
            inline: true 
          },
          { 
            name: 'Substitutes', 
            value: botConfig.matchRules.allowSubstitutes ? 'Allowed' : 'Not Allowed',
            inline: true 
          }
        )
        .setFooter({ text: 'Current configuration' });
      
      await interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('Error executing config command', { error, userId: interaction.user.id });
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Error')
      .setDescription('There was an error retrieving the configuration information. Please try again later.');
    
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}