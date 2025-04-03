
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { storage } from '../../storage';
import { logger } from '../../bot/utils/logger';
import { QueueService } from '../../bot/services/queueService';
import { PlayerService } from '../../bot/services/playerService';

export const data = new SlashCommandBuilder()
  .setName('adminqueue')
  .setDescription('Admin command to add a player to queue by Discord ID')
  .addStringOption(option =>
    option
      .setName('discord_id')
      .setDescription('Discord ID of the player to add to queue')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    // Check if user has admin permission
    const botConfig = await storage.getBotConfig();
    const isAdmin = interaction.member?.roles instanceof Array 
      ? false 
      : botConfig.general.adminRoleIds.some(roleId => 
          interaction.member?.roles?.cache.has(roleId)
        );
    
    if (!isAdmin) {
      return interaction.editReply({
        content: '❌ You do not have permission to use this command.'
      });
    }
    
    // Get Discord ID from options
    const discordId = interaction.options.getString('discord_id', true);
    
    // Create services
    const playerService = new PlayerService(storage);
    const queueService = new QueueService(storage);
    
    // Check if player already exists in the system
    let player = await playerService.getPlayerByDiscordId(discordId);
    
    // If player doesn't exist, create a minimal player record
    if (!player) {
      player = await playerService.ensurePlayerExists({
        id: discordId,
        username: `TestUser_${discordId.substring(0, 6)}`,
        discriminator: '0000',
        avatar: null
      });
      
      logger.info(`Admin created test player with Discord ID: ${discordId}`);
    }
    
    // Add player to queue
    const queueResult = await queueService.addPlayerToQueue(player.id);
    
    if (!queueResult.success) {
      return interaction.editReply({
        content: `❌ Failed to add player to queue: ${queueResult.message}`
      });
    }
    
    // Get updated queue count
    const queueCount = await queueService.getQueueSize();
    
    // Create response embed
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Admin Queue Action')
      .setDescription(`Successfully added player with Discord ID \`${discordId}\` to the queue.`)
      .addFields(
        { name: 'Player ID', value: `${player.id}`, inline: true },
        { name: 'Username', value: player.username, inline: true },
        { name: 'Current Queue Size', value: `${queueCount} players`, inline: true }
      );
    
    await interaction.editReply({ embeds: [embed] });
    
    // Check if we have enough players to create a match
    if (interaction.guild) {
      const canCreateMatch = await queueService.checkAndCreateMatch(interaction.guild);
      
      if (canCreateMatch) {
        logger.info('Enough players in queue after admin addition, creating match');
      }
    }
    
  } catch (error) {
    logger.error('Error executing adminqueue command', { error, userId: interaction.user.id });
    
    await interaction.editReply({
      content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
    });
  }
}
