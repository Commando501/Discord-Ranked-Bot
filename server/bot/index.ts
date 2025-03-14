import { Client, IntentsBitField, Events, Collection, GatewayIntentBits } from 'discord.js';
import { registerCommands } from './commands';
import { logger } from './utils/logger';
import { storage } from '../storage';
import { QueueService } from './services/queueService';
import { PlayerService } from './services/playerService';

export class DiscordBot {
  private client: Client;
  private queueService: QueueService;
  private playerService: PlayerService;
  
  constructor() {
    this.client = new Client({
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ]
    });
    
    this.queueService = new QueueService(storage);
    this.playerService = new PlayerService(storage);
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.client.once(Events.ClientReady, async (c) => {
      logger.info(`Discord bot logged in as ${c.user.tag}`);
      await registerCommands(this.client);
    });
    
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isCommand()) return;
      
      try {
        const { commandName } = interaction;
        
        // Quick registration of new players if needed
        if (!interaction.user.bot) {
          await this.playerService.ensurePlayerExists({
            discordId: interaction.user.id,
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            avatar: interaction.user.avatar || ''
          });
        }
        
        // Handle slash commands
        const command = (this.client as any).commands.get(commandName);
        if (!command) {
          logger.warn(`Command not found: ${commandName}`);
          return;
        }
        
        await command.execute(interaction, this.client);
      } catch (error) {
        logger.error(`Error executing command: ${error}`);
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ 
            content: 'An error occurred while executing this command.',
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: 'An error occurred while executing this command.',
            ephemeral: true 
          });
        }
      }
    });
    
    this.client.on(Events.Error, (error) => {
      logger.error(`Discord client error: ${error}`);
    });
  }
  
  public async start() {
    try {
      if (!process.env.DISCORD_TOKEN) {
        throw new Error('DISCORD_TOKEN is not defined in environment');
      }
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      logger.error(`Failed to start bot: ${error}`);
      throw error;
    }
  }
  
  public async stop() {
    if (this.client) {
      this.client.destroy();
      logger.info('Discord bot disconnected');
    }
  }
}

// Initialize the bot when the file is imported
let bot: DiscordBot | null = null;

export async function initializeBot() {
  if (!bot) {
    bot = new DiscordBot();
    await bot.start();
  }
  return bot;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down bot...');
  if (bot) await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down bot...');
  if (bot) await bot.stop();
  process.exit(0);
});

// Initialize the bot if this file is run directly
if (require.main === module) {
  initializeBot().catch(err => {
    logger.error('Failed to initialize bot:', err);
    process.exit(1);
  });
}
