import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from "discord.js";
import { storage } from "../../storage";
import { getQueueService } from "../../index.bot";
import { InsertPlayer } from "../../../shared/schema";

export const data = new SlashCommandBuilder()
  .setName("adminqueueadd")
  .setDescription("Admin command to add a player to queue by Discord ID (testing only)")
  .addStringOption(option =>
    option.setName("discord_id")
      .setDescription("Discord ID of the player to add")
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get Discord ID from options
    const discordId = interaction.options.getString("discord_id", true);
    
    if (!/^\d{17,19}$/.test(discordId)) {
      return await interaction.editReply("Invalid Discord ID format. Please provide a valid Discord user ID.");
    }
    
    // Check if player exists in the database
    let player = await storage.getPlayerByDiscordId(discordId);
    
    // If player doesn't exist, create a mock player for testing
    if (!player) {
      const mockPlayer: InsertPlayer = {
        discordId: discordId,
        username: `TestUser_${discordId.substring(0, 5)}`,
        discriminator: "0000",
        avatar: null,
        mmr: 1000,
        wins: 0,
        losses: 0,
        winStreak: 0,
        lossStreak: 0,
        isActive: true
      };
      
      player = await storage.createPlayer(mockPlayer);
      await interaction.editReply(`Created mock player with ID ${player.id} and Discord ID ${discordId}.`);
    }
    
    // Get queue service and add player to queue
    const queueService = getQueueService();
    if (!queueService) {
      return await interaction.editReply("Queue service is not available. Please try again later.");
    }
    
    // Check if player is already in queue
    const isInQueue = await queueService.isPlayerInQueue(player.id);
    if (isInQueue) {
      return await interaction.editReply(`Player with Discord ID ${discordId} is already in queue.`);
    }
    
    // Check if player is in an active match
    const isInMatch = await queueService.isPlayerInActiveMatch(player.id);
    if (isInMatch) {
      return await interaction.editReply(`Player with Discord ID ${discordId} is currently in an active match.`);
    }
    
    // Add player to queue
    const result = await queueService.addPlayerToQueue(player.id);
    
    if (result.success) {
      await interaction.editReply(`Successfully added player with Discord ID ${discordId} to queue.`);
    } else {
      await interaction.editReply(`Failed to add player to queue: ${result.message}`);
    }
  } catch (error) {
    console.error("Error in adminqueueadd command:", error);
    await interaction.editReply("An error occurred while adding player to queue. Check logs for details.");
  }
}