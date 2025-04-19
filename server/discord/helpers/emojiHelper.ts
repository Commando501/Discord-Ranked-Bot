
import { Client } from 'discord.js';
import { logger } from '../../bot/utils/logger';

/**
 * Helper class for managing Discord emojis
 */
export class EmojiHelper {
  private client: Client;
  private cachedEmojis: Map<string, string> = new Map();
  
  constructor(client: Client) {
    this.client = client;
  }
  
  /**
   * Loads all custom emojis from a specific guild
   * @param guildId The Discord guild ID to load emojis from
   * @returns A promise that resolves when emojis are loaded
   */
  public async loadEmojisFromGuild(guildId: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const emojis = await guild.emojis.fetch();
      
      emojis.forEach(emoji => {
        const emojiString = `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
        if (emoji.name) {
          this.cachedEmojis.set(emoji.name, emojiString);
        }
      });
      
      logger.info(`Loaded ${this.cachedEmojis.size} emojis from guild ${guildId}`);
    } catch (error) {
      logger.error('Error loading emojis from guild', { error, guildId });
    }
  }
  
  /**
   * Gets an emoji by name
   * @param name The emoji name
   * @returns The emoji string or undefined if not found
   */
  public getEmoji(name: string): string | undefined {
    return this.cachedEmojis.get(name);
  }
  
  /**
   * Gets all loaded emojis
   * @returns Map of emoji names to emoji strings
   */
  public getAllEmojis(): Map<string, string> {
    return this.cachedEmojis;
  }
  
  /**
   * Adds a manually configured emoji
   * @param name The emoji name
   * @param id The emoji ID
   * @param animated Whether the emoji is animated
   */
  public addEmoji(name: string, id: string, animated: boolean = false): void {
    const emojiString = `<${animated ? 'a' : ''}:${name}:${id}>`;
    this.cachedEmojis.set(name, emojiString);
  }
}

// Create a static map for hard-coded emojis (for fallback)
export const rankEmojiMap: Record<string, string> = {
  'Iron 1': '<:Iron1:1363039589538861057>',
  'Iron 2': '<:Iron2:1363039575013851156>',
  'Bronze 3': '<:Bronze3:1363039607536615454>',
  'Bronze 2': '<:Bronze2:1363039615044288522>',
  'Bronze 1': '<:Bronze1:1363039622195839107>',
  'Silver 3': '<:Silver3:1363039663228719124>',
  'Silver 2': '<:Silver2:1363039669922824344>',
  'Silver 1': '<:Silver1:1363039677724233849>',
  'Gold 3': '<:Gold3:1363042192196632666>',
  'Gold 2': '<:Gold2:1363042203340902530>',
  'Gold 1': '<:Gold1:1363042214715986041>',
  'Platinum 3': '<:Platinum3:1363039687358287872>',
  'Platinum 2': '<:Platinum2:1363039694878806186>',
  'Platinum 1': '<:Platinum1:1363039703909138502>',
  'Diamond 3': '<:Diamond3:1363039725136379955>',
  'Diamond 2': '<:Diamond2:1363039734028435618>',
  'Diamond 1': '<:Diamond1:1363039742249402428>',
  'Masters 3': '<:Masters3:1363039762142986350>',
  'Masters 2': '<:Masters2:1363039770342723604>',
  'Masters 1': '<:Masters1:1363039778580205619>',
  'Challenger': '<:Challenger:1363039996868558879>'
};
