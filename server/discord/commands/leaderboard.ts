
import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from 'discord.js';
import { logger } from '../../bot/utils/logger';
import { storage } from '../../storage';
import { getPlayerRank } from '@shared/rankSystem';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the ranked leaderboard of players')
  .addIntegerOption(option => 
    option.setName('page')
      .setDescription('Page number to view')
      .setRequired(false));

export async function execute(interaction: any) {
  await interaction.deferReply();
  
  try {
    // Get all active players from storage (using available method)
    const allPlayers = await storage.listTopPlayers(1000); // Get up to 1000 players to ensure we have all
    
    // Get bot config to access rank tiers
    const botConfig = await storage.getBotConfig();
    const rankTiers = botConfig.seasonManagement?.rankTiers || [];
    
    // Sort players by MMR (highest first)
    const sortedPlayers = allPlayers.sort((a, b) => b.mmr - a.mmr);
    
    // Calculate total pages
    const playersPerPage = 10;
    const totalPages = Math.ceil(sortedPlayers.length / playersPerPage);
    
    // Get requested page or default to first page
    let currentPage = interaction.options.getInteger('page') || 1;
    
    // Validate page number
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    // Create the embed for the current page
    const generateEmbed = (pageNum: number) => {
      const startIdx = (pageNum - 1) * playersPerPage;
      const endIdx = Math.min(startIdx + playersPerPage, sortedPlayers.length);
      const pagePlayers = sortedPlayers.slice(startIdx, endIdx);
      
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Player Leaderboard')
        .setDescription(`Showing players ranked by MMR (Page ${pageNum}/${totalPages})`)
        .setFooter({ text: `Total Players: ${sortedPlayers.length}` });
      
      // Create fields for each player on this page
      const playerFields = pagePlayers.map((player, index) => {
        const actualRank = startIdx + index + 1;
        const playerRank = getPlayerRank(player.mmr, rankTiers);
        const winRate = player.wins + player.losses > 0
          ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
          : "0.0";
          
        // Get the rank emoji if available
        let rankEmoji = '';
        try {
          // Try to get the emoji from the Discord server
          if (playerRank && interaction.guild) {
            const emojiName = playerRank.name.replace(/\s+/g, '').toLowerCase();
            const foundEmoji = interaction.guild.emojis.cache.find(
              (e: any) => e.name.toLowerCase() === emojiName
            );
            
            if (foundEmoji) {
              rankEmoji = ` ${foundEmoji}`;
            }
          }
        } catch (emojiError) {
          logger.error(`Error getting rank emoji: ${emojiError}`);
        }
        
        return {
          name: `#${actualRank} ${player.username}`,
          value: `**Rank:** ${playerRank?.name || 'Unranked'}${rankEmoji}\n**MMR:** ${player.mmr}\n**W/L:** ${player.wins}/${player.losses} (${winRate}%)`
        };
      });
      
      embed.addFields(playerFields);
      return embed;
    };
    
    // Create pagination buttons
    const generateButtons = (pageNum: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('first')
            .setLabel('⏪ First')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageNum === 1),
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageNum === 1),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageNum === totalPages),
          new ButtonBuilder()
            .setCustomId('last')
            .setLabel('Last ⏩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageNum === totalPages)
        );
      return row;
    };
    
    // Send initial response
    const initialEmbed = generateEmbed(currentPage);
    const initialButtons = generateButtons(currentPage);
    
    const response = await interaction.editReply({
      embeds: [initialEmbed],
      components: totalPages > 1 ? [initialButtons] : []
    });
    
    // Only set up collector if we have multiple pages
    if (totalPages > 1) {
      // Create button collector for pagination
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 180000 // 3 minutes
      });
      
      collector.on('collect', async (buttonInteraction: any) => {
        // Handle user authorization
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: `Only ${interaction.user.username} can use these buttons.`,
            ephemeral: true
          });
          return;
        }
        
        // Update page based on button pressed
        switch (buttonInteraction.customId) {
          case 'first':
            currentPage = 1;
            break;
          case 'previous':
            currentPage--;
            break;
          case 'next':
            currentPage++;
            break;
          case 'last':
            currentPage = totalPages;
            break;
        }
        
        // Update the message with the new page
        await buttonInteraction.update({
          embeds: [generateEmbed(currentPage)],
          components: [generateButtons(currentPage)]
        });
      });
      
      collector.on('end', async () => {
        // Remove buttons when collector expires
        await interaction.editReply({
          embeds: [generateEmbed(currentPage)],
          components: []
        });
      });
    }
  } catch (error) {
    logger.error(`Error in leaderboard command: ${error}`);
    await interaction.editReply('There was an error executing this command. Please try again later.');
  }
}
