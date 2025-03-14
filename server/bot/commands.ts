import { 
  Client, 
  Collection, 
  SlashCommandBuilder, 
  REST, 
  Routes,
  CommandInteraction,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { config } from './config';
import { logger } from './utils/logger';
import { storage } from '../storage';
import { QueueService } from './services/queueService';
import { PlayerService } from './services/playerService';
import { MatchService } from './services/matchService';
import { formatDuration } from './utils/helpers';

const queueService = new QueueService(storage);
const playerService = new PlayerService(storage);
const matchService = new MatchService(storage);

// Command definitions
export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('queue')
      .setDescription('Join the matchmaking queue'),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const player = await playerService.getOrCreatePlayer({
          id: interaction.user.id,
          username: interaction.user.username,
          discriminator: interaction.user.discriminator,
          avatar: interaction.user.avatar
        });
        
        const isAlreadyQueued = await queueService.isPlayerInQueue(player.id);
        if (isAlreadyQueued) {
          return interaction.followUp({
            content: '❌ You are already in the queue.',
            ephemeral: true
          });
        }
        
        await queueService.addPlayerToQueue(player.id);
        
        const queueCount = await queueService.getQueueSize();
        const requiredPlayers = config.REQUIRED_PLAYERS_PER_MATCH;
        
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('Joined Queue')
          .setDescription(`You have been added to the matchmaking queue.`)
          .addFields(
            { name: 'Queue Status', value: `${queueCount}/${requiredPlayers} players` },
            { name: 'Your MMR', value: player.mmr.toString() }
          )
          .setFooter({ text: 'Use /leave to leave the queue' });
        
        await interaction.followUp({ 
          embeds: [embed],
          ephemeral: true 
        });
        
        // Check if we can create a match
        if (queueCount >= requiredPlayers) {
          const message = await interaction.channel?.send({
            content: `⚠️ Queue has ${queueCount}/${requiredPlayers} players - checking for match creation...`
          });
          
          const matchCreated = await queueService.checkAndCreateMatch(interaction.guild!);
          
          if (matchCreated && message) {
            setTimeout(() => message.delete().catch(), 5000);
          }
        }
      } catch (error) {
        logger.error(`Error in queue command: ${error}`);
        await interaction.followUp({
          content: 'Failed to join the queue. Please try again later.',
          ephemeral: true
        });
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Leave the matchmaking queue'),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const player = await playerService.getPlayerByDiscordId(interaction.user.id);
        
        if (!player) {
          return interaction.followUp({
            content: '❌ You are not registered in our system.',
            ephemeral: true
          });
        }
        
        const removed = await queueService.removePlayerFromQueue(player.id);
        
        if (!removed) {
          return interaction.followUp({
            content: '❌ You are not in the queue.',
            ephemeral: true
          });
        }
        
        await interaction.followUp({
          content: '✅ You have been removed from the queue.',
          ephemeral: true
        });
      } catch (error) {
        logger.error(`Error in leave command: ${error}`);
        await interaction.followUp({
          content: 'Failed to leave the queue. Please try again later.',
          ephemeral: true
        });
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('list')
      .setDescription('List all players currently in the queue'),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        const queuePlayers = await queueService.getQueuePlayersWithInfo();
        
        if (queuePlayers.length === 0) {
          return interaction.followUp('The queue is currently empty.');
        }
        
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('Current Queue')
          .setDescription(`${queuePlayers.length}/${config.REQUIRED_PLAYERS_PER_MATCH} players in queue`)
          .setTimestamp();
        
        queuePlayers.forEach((entry, index) => {
          const waitTime = formatDuration(new Date().getTime() - entry.joinedAt.getTime());
          embed.addFields({
            name: `${index + 1}. ${entry.player.username}`,
            value: `MMR: ${entry.player.mmr} | Waiting: ${waitTime}`,
            inline: false
          });
        });
        
        await interaction.followUp({ embeds: [embed] });
      } catch (error) {
        logger.error(`Error in list command: ${error}`);
        await interaction.followUp('Failed to retrieve the queue. Please try again later.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('profile')
      .setDescription('View player statistics')
      .addUserOption(option => 
        option
          .setName('user')
          .setDescription('The user to view profile for')
          .setRequired(false)
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        const player = await playerService.getPlayerByDiscordId(targetUser.id);
        
        if (!player) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? 'You have not played any matches yet.'
              : `${targetUser.username} has not played any matches yet.`
          );
        }
        
        const winRate = player.wins + player.losses > 0
          ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
          : '0.0';
        
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`${player.username}'s Profile`)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: 'MMR', value: player.mmr.toString(), inline: true },
            { name: 'Wins', value: player.wins.toString(), inline: true },
            { name: 'Losses', value: player.losses.toString(), inline: true },
            { name: 'Win Rate', value: `${winRate}%`, inline: true },
            { 
              name: 'Current Streak', 
              value: player.winStreak > 0
                ? `🔥 ${player.winStreak} wins`
                : player.lossStreak > 0
                  ? `❄️ ${player.lossStreak} losses`
                  : 'No streak',
              inline: true
            }
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [embed] });
      } catch (error) {
        logger.error(`Error in profile command: ${error}`);
        await interaction.followUp('Failed to retrieve player profile. Please try again later.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('history')
      .setDescription('View match history')
      .addUserOption(option => 
        option
          .setName('user')
          .setDescription('The user to view match history for')
          .setRequired(false)
      )
      .addIntegerOption(option => 
        option
          .setName('count')
          .setDescription('Number of matches to show')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10)
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const count = interaction.options.getInteger('count') || 5;
        
        const player = await playerService.getPlayerByDiscordId(targetUser.id);
        
        if (!player) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? 'You have not played any matches yet.'
              : `${targetUser.username} has not played any matches yet.`
          );
        }
        
        const matches = await storage.getPlayerMatches(player.id, count);
        
        if (matches.length === 0) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? 'You have not played any matches yet.'
              : `${targetUser.username} has not played any matches yet.`
          );
        }
        
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`${player.username}'s Match History`)
          .setDescription(`Recent ${matches.length} matches`);
        
        for (const match of matches) {
          const teams = await storage.getMatchTeams(match.id);
          const playerTeam = teams.find(t => 
            t.players.some(p => p.id === player.id)
          );
          
          if (!playerTeam) continue;
          
          const isWinner = match.winningTeamId === playerTeam.id;
          const matchResult = match.status === 'COMPLETED'
            ? isWinner ? 'Win' : 'Loss'
            : match.status;
          
          const opponentTeam = teams.find(t => t.id !== playerTeam.id);
          const opponentText = opponentTeam 
            ? `vs Team ${opponentTeam.name} (Avg MMR: ${opponentTeam.avgMMR})`
            : 'vs Unknown Opponent';
          
          const date = new Date(match.createdAt).toLocaleDateString();
          const fieldColor = isWinner ? '🟢' : '🔴';
          
          embed.addFields({
            name: `${fieldColor} Match #${match.id} - ${matchResult}`,
            value: `${date} | Team ${playerTeam.name} (Avg MMR: ${playerTeam.avgMMR}) ${opponentText}`,
            inline: false
          });
        }
        
        await interaction.followUp({ embeds: [embed] });
      } catch (error) {
        logger.error(`Error in history command: ${error}`);
        await interaction.followUp('Failed to retrieve match history. Please try again later.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('streak')
      .setDescription('Display your current win/loss streak')
      .addUserOption(option => 
        option
          .setName('user')
          .setDescription('The user to view streak for')
          .setRequired(false)
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        const player = await playerService.getPlayerByDiscordId(targetUser.id);
        
        if (!player) {
          return interaction.followUp(
            targetUser.id === interaction.user.id
              ? 'You have not played any matches yet.'
              : `${targetUser.username} has not played any matches yet.`
          );
        }
        
        let streakType = 'No streak';
        let streakValue = 0;
        let streakEmoji = '😐';
        let color = '#5865F2';
        
        if (player.winStreak > 0) {
          streakType = 'Win Streak';
          streakValue = player.winStreak;
          streakEmoji = '🔥';
          color = '#3BA55C';
        } else if (player.lossStreak > 0) {
          streakType = 'Loss Streak';
          streakValue = player.lossStreak;
          streakEmoji = '❄️';
          color = '#ED4245';
        }
        
        const embed = new EmbedBuilder()
          .setColor(color as any)
          .setTitle(`${player.username}'s Current Streak`)
          .setDescription(`${streakEmoji} **${streakType}**: ${streakValue}`)
          .addFields(
            { name: 'Total Wins', value: player.wins.toString(), inline: true },
            { name: 'Total Losses', value: player.losses.toString(), inline: true },
            { 
              name: 'Win Rate', 
              value: player.wins + player.losses > 0
                ? `${((player.wins / (player.wins + player.losses)) * 100).toFixed(1)}%`
                : '0.0%',
              inline: true
            }
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [embed] });
      } catch (error) {
        logger.error(`Error in streak command: ${error}`);
        await interaction.followUp('Failed to retrieve streak information. Please try again later.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('votekick')
      .setDescription('Vote to kick a player from a match')
      .addUserOption(option => 
        option
          .setName('target')
          .setDescription('The player to kick')
          .setRequired(true)
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        const targetUser = interaction.options.getUser('target');
        
        if (!targetUser) {
          return interaction.followUp('Please specify a valid user to kick.');
        }
        
        if (targetUser.id === interaction.user.id) {
          return interaction.followUp('You cannot vote to kick yourself. Use /leave to leave the queue.');
        }
        
        // Check if both players are in a match
        const initiator = await playerService.getPlayerByDiscordId(interaction.user.id);
        const target = await playerService.getPlayerByDiscordId(targetUser.id);
        
        if (!initiator || !target) {
          return interaction.followUp('One or both players are not registered in our system.');
        }
        
        const result = await matchService.initiateVoteKick(initiator.id, target.id, interaction);
        
        if (result.success) {
          await interaction.followUp(result.message);
        } else {
          await interaction.followUp(`❌ ${result.message}`);
        }
      } catch (error) {
        logger.error(`Error in votekick command: ${error}`);
        await interaction.followUp('Failed to initiate vote kick. Please try again later.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('forcematch')
      .setDescription('Admin: Force create a match with specified players')
      .addUserOption(option => 
        option
          .setName('player1')
          .setDescription('Player 1')
          .setRequired(true)
      )
      .addUserOption(option => 
        option
          .setName('player2')
          .setDescription('Player 2')
          .setRequired(true)
      )
      .addUserOption(option => 
        option
          .setName('player3')
          .setDescription('Player 3')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('player4')
          .setDescription('Player 4')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('player5')
          .setDescription('Player 5')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('player6')
          .setDescription('Player 6')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('player7')
          .setDescription('Player 7')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('player8')
          .setDescription('Player 8')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('player9')
          .setDescription('Player 9')
          .setRequired(false)
      )
      .addUserOption(option => 
        option
          .setName('player10')
          .setDescription('Player 10')
          .setRequired(false)
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has('Administrator')) {
          return interaction.followUp('❌ You do not have permission to use this command.');
        }
        
        const playerOptions = [
          'player1', 'player2', 'player3', 'player4', 'player5',
          'player6', 'player7', 'player8', 'player9', 'player10'
        ];
        
        const playerUsers = playerOptions
          .map(option => interaction.options.getUser(option))
          .filter(Boolean);
        
        if (playerUsers.length < 2) {
          return interaction.followUp('❌ You need to specify at least 2 players.');
        }
        
        // Get or create players
        const players = [];
        for (const user of playerUsers) {
          if (!user) continue;
          
          const player = await playerService.getOrCreatePlayer({
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar
          });
          
          players.push(player);
        }
        
        // Force create match
        const result = await matchService.createMatchWithPlayers(
          players.map(p => p.id),
          interaction.guild!
        );
        
        if (result.success) {
          await interaction.followUp(`✅ Match created! ${result.message}`);
        } else {
          await interaction.followUp(`❌ Failed to create match: ${result.message}`);
        }
      } catch (error) {
        logger.error(`Error in forcematch command: ${error}`);
        await interaction.followUp('Failed to create match. Please try again later.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('endmatch')
      .setDescription('Admin: End a match and record results')
      .addIntegerOption(option => 
        option
          .setName('match_id')
          .setDescription('The ID of the match to end')
          .setRequired(true)
      )
      .addIntegerOption(option => 
        option
          .setName('winning_team')
          .setDescription('The ID of the winning team')
          .setRequired(true)
      ),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has('Administrator')) {
          return interaction.followUp('❌ You do not have permission to use this command.');
        }
        
        const matchId = interaction.options.getInteger('match_id');
        const winningTeamId = interaction.options.getInteger('winning_team');
        
        if (!matchId || !winningTeamId) {
          return interaction.followUp('❌ Please provide both match ID and winning team ID.');
        }
        
        const result = await matchService.endMatch(matchId, winningTeamId);
        
        if (result.success) {
          await interaction.followUp(`✅ Match ended successfully! ${result.message}`);
        } else {
          await interaction.followUp(`❌ Failed to end match: ${result.message}`);
        }
      } catch (error) {
        logger.error(`Error in endmatch command: ${error}`);
        await interaction.followUp('Failed to end match. Please try again later.');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('resetqueue')
      .setDescription('Admin: Reset the queue'),
    execute: async (interaction: CommandInteraction) => {
      await interaction.deferReply();
      
      try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has('Administrator')) {
          return interaction.followUp('❌ You do not have permission to use this command.');
        }
        
        await queueService.clearQueue();
        
        await interaction.followUp('✅ Queue has been reset.');
      } catch (error) {
        logger.error(`Error in resetqueue command: ${error}`);
        await interaction.followUp('Failed to reset queue. Please try again later.');
      }
    }
  }
];

export async function registerCommands(client: Client) {
  try {
    const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
    
    logger.info('Started refreshing application (/) commands.');
    
    (client as any).commands = new Collection();
    
    const commandsData = commands.map(command => command.data.toJSON());
    
    await rest.put(
      Routes.applicationCommands(config.CLIENT_ID),
      { body: commandsData }
    );
    
    commands.forEach(command => {
      (client as any).commands.set(command.data.name, command);
    });
    
    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error(`Error registering commands: ${error}`);
  }
}
