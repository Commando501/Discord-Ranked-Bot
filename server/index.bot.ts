import { Client, GatewayIntentBits, Events, TextChannel } from 'discord.js';
import { setupCommandHandlers } from './bot/commands';
import { logger } from './bot/utils/logger';
import { config } from './bot/config';
import { storage } from './storage';
import { QueueService } from './bot/services/queueService';
import { PlayerService } from './bot/services/playerService';
import { MatchService } from './bot/services/matchService';
import { DiscordUser } from '@shared/schema';
import { initializeBot as initializeEnhancedBot, getDiscordClient as getEnhancedClient } from './discord/bot';

// Initialize services immediately regardless of Discord bot status
let queueService = QueueService.getInstance(storage);
let playerService = new PlayerService(storage);
let matchService = new MatchService(storage);

// Use the enhanced Discord client from ./discord/bot.ts
export async function initializeBot() {
  try {
    await initializeEnhancedBot();
    const client = getEnhancedClient();

    if (!client) {
      logger.warn('Could not initialize enhanced Discord client. Bot functionality will be limited, but services are available.');
      return null;
    }

      // Handle message events specifically for vote processing
    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;

      // Skip if not in a text channel or if the channel doesn't have a name property
      if (!message.channel || !('name' in message.channel)) return;

      const textChannel = message.channel as TextChannel;

      // Handle vote messages for votekick
      // Example format: "yes" or "no" in a match channel
      if ((message.content.toLowerCase() === 'yes' || message.content.toLowerCase() === 'no') && 
          textChannel.name.startsWith('match-')) {
        try {
          const matchId = parseInt(textChannel.name.replace('match-', ''));

          if (isNaN(matchId)) return;

          const player = await playerService.getPlayerByDiscordId(message.author.id);
          if (!player) return;

          // Find active votekicks in this match
          const activeMatches = await storage.getActiveMatches();
          const match = activeMatches.find(m => m.id === matchId);

          if (!match) return;

          // Check if there are any active votekicks
          const activeVoteKick = await storage.getActiveVoteKick(matchId, player.id);

          if (!activeVoteKick) return;

          // Record the vote
          const isApprove = message.content.toLowerCase() === 'yes';
          await storage.addVoteKickVote({
            voteKickId: activeVoteKick.id,
            playerId: player.id,
            approve: isApprove
          });

          // Check if we have enough votes to complete the votekick
          const votes = await storage.getVoteKickVotes(activeVoteKick.id);
          const totalTeamSize = match.teams.find(t => 
            t.players.some(p => p.id === activeVoteKick.targetPlayerId)
          )?.players.length || 0;

          const requiredVotes = Math.ceil(totalTeamSize / 2);
          const approveVotes = votes.filter(v => v.approve).length;

          if (approveVotes >= requiredVotes) {
            // Votekick passed
            await storage.updateVoteKick(activeVoteKick.id, {
              status: 'APPROVED',
              finishedAt: new Date()
            });

            // Notify about the successful vote
            message.channel.send(`Vote to kick <@${player.discordId}> has passed. They have been removed from the match.`);
          } else if (votes.length >= totalTeamSize) {
            // All votes are in but not enough to kick
            await storage.updateVoteKick(activeVoteKick.id, {
              status: 'REJECTED',
              finishedAt: new Date()
            });

            message.channel.send(`Vote to kick failed. Not enough votes to remove the player.`);
          } else {
            // Still waiting for more votes
            message.reply(`Vote recorded. ${approveVotes}/${requiredVotes} votes to kick.`);
          }
        } catch (error: any) {
          logger.error(`Error processing vote: ${error.message}`);
        }
      }
    });

    // Handle button interactions (for match voting)
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;

      try {
        const { customId } = interaction;

        // Parse vote_<matchId>_team<number>
        if (customId.startsWith('vote_')) {
          const parts = customId.split('_');
          if (parts.length !== 3) return;

          const matchId = parseInt(parts[1]);
          const teamType = parts[2]; // team1 or team2

          if (isNaN(matchId)) return;

          const player = await playerService.getPlayerByDiscordId(interaction.user.id);
          if (!player) {
            return interaction.reply({
              content: 'You are not registered in our system.',
              ephemeral: true
            });
          }

          // Get the match and teams
          const match = await storage.getMatch(matchId);
          if (!match || match.status !== 'ACTIVE') {
            return interaction.reply({
              content: 'This match is no longer active.',
              ephemeral: true
            });
          }

          const teams = await storage.getMatchTeams(matchId);
          const votedTeamId = teams.find(t => 
            teamType === 'team1' ? t.name === 'Eagle' : t.name === 'Cobra'
          )?.id;

          if (!votedTeamId) {
            return interaction.reply({
              content: 'Team not found.',
              ephemeral: true
            });
          }

          // Record the vote
          await storage.addMatchVote({
            matchId,
            playerId: player.id,
            votedTeamId
          });

          // Check if we have enough votes to end the match
          const votes = await storage.getMatchVotes(matchId);
          const team1Votes = votes.filter(v => v.votedTeamId === teams[0].id).length;
          const team2Votes = votes.filter(v => v.votedTeamId === teams[1].id).length;

          // Simple majority wins
          const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);
          const requiredVotes = Math.ceil(totalPlayers / 2);

          if (team1Votes >= requiredVotes) {
            // Team 1 wins
            await matchService.endMatch(matchId, teams[0].id);
            await interaction.reply(`Team ${teams[0].name} has won the match! Match results have been recorded.`);
          } else if (team2Votes >= requiredVotes) {
            // Team 2 wins
            await matchService.endMatch(matchId, teams[1].id);
            await interaction.reply(`Team ${teams[1].name} has won the match! Match results have been recorded.`);
          } else {
            // Still waiting for more votes
            await interaction.reply({
              content: `Vote recorded! Current votes:\nTeam ${teams[0].name}: ${team1Votes}\nTeam ${teams[1].name}: ${team2Votes}\nNeeded for win: ${requiredVotes}`,
              ephemeral: true
            });
          }
        }
      } catch (error: any) {
        logger.error(`Error processing button interaction: ${error.message}`);
        await interaction.reply({
          content: 'An error occurred while processing your vote.',
          ephemeral: true
        });
      }
    });

    client.on(Events.Error, (error) => {
      logger.error(`Discord client error: ${error}`);
    });

    // Return the client - no need to login again as it's handled by the enhanced client
    logger.info('Enhanced Discord client initialization completed');
    return client;

  } catch (error: any) {
    logger.error(`Error setting up Discord client: ${error.message}`);
    return null;
  }
}

export function getBot() {
  // Use the enhanced client from discord/bot.ts
  return getEnhancedClient();
}

export function getQueueService() {
  return queueService;
}

export function getPlayerService() {
  return playerService;
}

export function getMatchService() {
  return matchService;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down bot...');
  const currentClient = getEnhancedClient();
  if (currentClient) currentClient.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down bot...');
  const currentClient = getEnhancedClient();
  if (currentClient) currentClient.destroy();
  process.exit(0);
});