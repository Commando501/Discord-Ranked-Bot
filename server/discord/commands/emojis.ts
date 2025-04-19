
import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { getEmojiHelper } from '../bot';
import { logger } from '../../bot/utils/logger';

export const data = new SlashCommandBuilder()
  .setName('emojis')
  .setDescription('Lists all available emoji IDs for use in the bot')
  .addStringOption(option => 
    option.setName('filter')
      .setDescription('Filter emojis by name')
      .setRequired(false));

export async function execute(interaction: CommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const emojiHelper = getEmojiHelper();
    if (!emojiHelper) {
      await interaction.editReply('Emoji helper is not initialized. Please check with the bot administrator.');
      return;
    }
    
    const filter = interaction.options.get('filter')?.value as string | undefined;
    const allEmojis = emojiHelper.getAllEmojis();
    
    let emojiList: string[] = [];
    allEmojis.forEach((emojiString, name) => {
      if (!filter || name.toLowerCase().includes((filter as string).toLowerCase())) {
        emojiList.push(`${emojiString} - \`${name}\` - \`${emojiString}\``);
      }
    });
    
    if (emojiList.length === 0) {
      await interaction.editReply('No emojis found with that filter or no emojis are available.');
      return;
    }
    
    // Create chunks to fit within Discord's character limits
    const chunks = [];
    let currentChunk = '';
    
    for (const emoji of emojiList) {
      if (currentChunk.length + emoji.length + 1 > 1024) {
        chunks.push(currentChunk);
        currentChunk = emoji;
      } else {
        currentChunk += currentChunk ? '\n' + emoji : emoji;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    // Create embeds for each chunk
    const embeds = chunks.map((chunk, index) => {
      return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`Available Emojis ${index + 1}/${chunks.length}`)
        .setDescription(chunk);
    });
    
    // Send first embed
    await interaction.editReply({ embeds: [embeds[0]] });
    
    // Send additional embeds as follow-ups if needed
    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({ embeds: [embeds[i]], ephemeral: true });
    }
    
  } catch (error) {
    logger.error('Error executing emojis command', { error });
    await interaction.editReply('An error occurred while listing emojis.');
  }
}
