import { 
  Guild, 
  TextChannel, 
  ChannelType, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder,
  CommandInteraction,
  GuildChannel,
  MessageCreateOptions,
  Client
} from 'discord.js';
import { IStorage } from '../../storage';
import { logger } from '../utils/logger';
import { calculateTeamsMMR } from '../utils/helpers';
import { BotConfig } from '@shared/botConfig';
import { getDiscordClient } from '../../discord/bot';

export class MatchService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Get active matches
   */
  async getActiveMatches(): Promise<any[]> {
    return this.storage.getActiveMatches();
  }

  /**
   * Get match details
   */
  async getMatchDetails(matchId: number): Promise<any> {
    return this.storage.getMatch(matchId);
  }

  /**
   * Get player match results
   */
  async getPlayerMatchResults(playerId: number, limit: number = 5): Promise<any[]> {
    return this.storage.getPlayerMatches(playerId, limit);
  }

  /**
   * Logs important events to the configured event log channel
   * @param title Event title
   * @param description Event description
   * @param fields Additional fields to include
   */
  async logEvent(title: string, description: string, fields: {name: string, value: string, inline?: boolean}[] = []) {
    try {
      const botConfig = await this.storage.getBotConfig();
      const logChannelId = botConfig.general.logEventChannelId;

      if (!logChannelId) {
        logger.debug('No event log channel configured, skipping event logging');
        return;
      }

      const client = getDiscordClient();
      if (!client) {
        logger.error('Discord client not available for event logging');
        return;
      }

      const logChannel = await client.channels.fetch(logChannelId);
      if (!logChannel || !logChannel.isTextBased()) {
        logger.error(`Event log channel ${logChannelId} not found or not a text channel`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📝 ${title}`)
        .setDescription(description)
        .addFields(fields)
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
      logger.debug(`Event logged to channel ${logChannelId}: ${title}`);
    } catch (error) {
      logger.error(`Failed to log event: ${error}`);
    }
  }

  async createMatchWithPlayers(playerIds: number[], guild: Guild): Promise<{ success: boolean, message: string, matchId?: number }> {
    try {
      if (playerIds.length < 2) {
        return { success: false, message: 'Need at least 2 players to create a match' };
      }

      // Create match record
      const match = await this.storage.createMatch({
        status: 'WAITING'
      });

      // Divide players into balanced teams
      const players = await Promise.all(playerIds.map(id => this.storage.getPlayer(id)));
      const validPlayers = players.filter(Boolean) as any[];

      if (validPlayers.length < 2) {
        return { success: false, message: 'Not enough valid players found' };
      }

      const teamsData = calculateTeamsMMR(validPlayers);

      // Create team records and assign players
      for (const [teamIndex, teamPlayers] of teamsData.teams.entries()) {
        const teamName = teamIndex === 0 ? 'Alpha' : 'Bravo';
        const avgMMR = teamIndex === 0 ? teamsData.team1MMR : teamsData.team2MMR;

        const team = await this.storage.createTeam({
          matchId: match.id,
          name: teamName,
          avgMMR
        });

        // Add players to team
        for (const player of teamPlayers) {
          await this.storage.addPlayerToTeam({
            teamId: team.id,
            playerId: player.id
          });
        }
      }

      // Update match status
      await this.storage.updateMatch(match.id, { status: 'ACTIVE' });

      // Try to create a match channel if possible
      let matchChannel: TextChannel | null = null;
      try {
        // Find or create a category for matches
        let matchCategory = guild.channels.cache.find(
          channel => channel.type === ChannelType.GuildCategory && channel.name === 'Matches'
        );

        if (!matchCategory) {
          matchCategory = await guild.channels.create({
            name: 'Matches',
            type: ChannelType.GuildCategory
          });
        }

        // Create a text channel for this match
        matchChannel = await guild.channels.create({
          name: `match-${match.id}`,
          type: ChannelType.GuildText,
          parent: matchCategory.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: ['ViewChannel']
            },
            ...playerIds.map(id => ({
              id: players.find(p => p?.id === id)?.discordId || '',
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            }))
          ]
        });

        // Get the team names from our created teams
        const matchTeams = await this.storage.getMatchTeams(match.id);
        const team1Name = matchTeams[0]?.name || 'Alpha';
        const team2Name = matchTeams[1]?.name || 'Bravo';

        // Send match details to the channel
        if (matchChannel) {
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`Match #${match.id}`)
            .setDescription('Your match has been created! Good luck and have fun!')
            .addFields(
              { 
                name: `Team ${team1Name} (Avg MMR: ${teamsData.team1MMR})`, 
                value: teamsData.teams[0].map(p => `<@${p.discordId}> (${p.mmr})`).join('\n'),
                inline: true
              },
              { 
                name: `Team ${team2Name} (Avg MMR: ${teamsData.team2MMR})`, 
                value: teamsData.teams[1].map(p => `<@${p.discordId}> (${p.mmr})`).join('\n'),
                inline: true
              }
            )
            .setTimestamp();

          // Create vote buttons
          const team1Button = new ButtonBuilder()
            .setCustomId(`vote_${match.id}_team1`)
            .setLabel(`Team ${team1Name} Won`)
            .setStyle(ButtonStyle.Success);

          const team2Button = new ButtonBuilder()
            .setCustomId(`vote_${match.id}_team2`)
            .setLabel(`Team ${team2Name} Won`)
            .setStyle(ButtonStyle.Danger);

          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(team1Button, team2Button);

          await matchChannel.send({ 
            content: playerIds.map(id => `<@${players.find(p => p?.id === id)?.discordId}>`).join(' '),
            embeds: [embed],
            components: [row]
          });
        }
      } catch (error) {
        logger.error(`Error creating match channel: ${error}`);
        // Continue without channel creation if it fails
      }

      // Log the match creation event
      await this.logEvent(
        "Match Created",
        `Match #${match.id} has been created successfully.`,
        [
          { name: 'Match ID', value: match.id.toString(), inline: true },
          { name: 'Players', value: validPlayers.length.toString(), inline: true },
          { name: 'Channel', value: matchChannel ? `<#${matchChannel.id}>` : 'None', inline: true }
        ]
      );

      return { 
        success: true, 
        message: matchChannel 
          ? `Match created! Check <#${matchChannel.id}> for details.`
          : 'Match created successfully!',
        matchId: match.id
      };
    } catch (error) {
      logger.error(`Error creating match: ${error}`);
      return { success: false, message: 'Failed to create match due to an error' };
    }
  }

  async endMatch(matchId: number, winningTeamId: number): Promise<{ success: boolean, message: string }> {
    try {
      const match = await this.storage.getMatch(matchId);

      if (!match) {
        return { success: false, message: 'Match not found' };
      }

      if (match.status !== 'ACTIVE' && match.status !== 'WAITING') {
        return { success: false, message: `Match is already ${match.status.toLowerCase()}` };
      }

      const winningTeam = await this.storage.getTeam(winningTeamId);

      if (!winningTeam) {
        return { success: false, message: 'Winning team not found' };
      }

      if (winningTeam.matchId !== matchId) {
        return { success: false, message: 'The specified team is not part of this match' };
      }

      // Get all teams for this match
      const matchTeams = await this.storage.getMatchTeams(matchId);

      if (matchTeams.length < 2) {
        return { success: false, message: 'Match does not have enough teams' };
      }

      // Update match status
      await this.storage.updateMatch(matchId, { 
        status: 'COMPLETED',
        finishedAt: new Date(),
        winningTeamId: winningTeamId
      });

      // Update player stats for each team
      for (const team of matchTeams) {
        const isWinningTeam = team.id === winningTeamId;

        for (const player of team.players) {
          // Get MMR settings from config
          const botConfig = await this.storage.getBotConfig();
          const mmrSettings = botConfig.mmrSystem;

          // Use kFactor from config for win/loss calculation
          // Calculate win/loss values based on kFactor from config
          const kFactor = mmrSettings.kFactor;
          const mmrGain = Math.round(kFactor * 0.75); // Simplified calculation
          const mmrLoss = Math.round(kFactor * 0.625); // Simplified calculation

          // Calculate MMR change - winners gain, losers lose
          const mmrChange = isWinningTeam ? mmrGain : -mmrLoss;

          // Update streaks
          let winStreak = player.winStreak;
          let lossStreak = player.lossStreak;

          if (isWinningTeam) {
            winStreak += 1;
            lossStreak = 0;
          } else {
            lossStreak += 1;
            winStreak = 0;
          }

          // Apply streak bonuses if applicable (using config values)
          let streakBonus = 0;
          if (winStreak >= mmrSettings.streakSettings.threshold) {
            streakBonus = Math.min(
              mmrSettings.streakSettings.maxBonus,
              Math.floor((winStreak - mmrSettings.streakSettings.threshold + 1) * mmrSettings.streakSettings.bonusPerWin)
            );
          }

          // Update player stats
          await this.storage.updatePlayer(player.id, {
            mmr: Math.max(1, player.mmr + mmrChange + streakBonus),
            wins: isWinningTeam ? player.wins + 1 : player.wins,
            losses: isWinningTeam ? player.losses : player.losses + 1,
            winStreak,
            lossStreak
          });
        }
      }

      // Log the match completion event
      const winningPlayers = matchTeams.find(team => team.id === winningTeamId)?.players || [];
      const losingPlayers = matchTeams.find(team => team.id !== winningTeamId)?.players || [];

      await this.logEvent(
        "Match Ended",
        `Match #${matchId} has been completed. Team ${winningTeam.name} has won!`,
        [
          { name: 'Match ID', value: matchId.toString(), inline: true },
          { name: 'Winning Team', value: winningTeam.name, inline: true },
          { name: 'Duration', value: match.createdAt ? `${Math.round((Date.now() - new Date(match.createdAt).getTime()) / 60000)} minutes` : 'Unknown', inline: true },
          { name: 'Winners', value: winningPlayers.map(p => p.username).join(', ') || 'None', inline: false },
          { name: 'Losers', value: losingPlayers.map(p => p.username).join(', ') || 'None', inline: false }
        ]
      );

      return { 
        success: true, 
        message: `Match #${matchId} has been completed. Team ${winningTeam.name} has won!`
      };
    } catch (error) {
      logger.error(`Error ending match: ${error}`);
      return { success: false, message: 'Failed to end match due to an error' };
    }
  }

  async initiateVoteKick(
    initiatorId: number, 
    targetId: number, 
    interaction: CommandInteraction
  ): Promise<{ success: boolean, message: string }> {
    try {
      if (initiatorId === targetId) {
        return { success: false, message: 'You cannot vote to kick yourself' };
      }

      // Find a match where both players are participating
      const initiator = await this.storage.getPlayer(initiatorId);
      const target = await this.storage.getPlayer(targetId);

      if (!initiator || !target) {
        return { success: false, message: 'One or both players not found' };
      }

      // Get active matches and check if both players are in the same match
      const activeMatches = await this.storage.getActiveMatches();

      let matchWithBothPlayers: any = null;
      let initiatorTeam: any = null;
      let targetTeam: any = null;

      for (const match of activeMatches) {
        for (const team of match.teams) {
          const hasInitiator = team.players.some(p => p.id === initiatorId);
          const hasTarget = team.players.some(p => p.id === targetId);

          if (hasInitiator) initiatorTeam = team;
          if (hasTarget) targetTeam = team;

          if (initiatorTeam && targetTeam) {
            matchWithBothPlayers = match;
            break;
          }
        }

        if (matchWithBothPlayers) break;
      }

      if (!matchWithBothPlayers) {
        return { success: false, message: 'You are not in the same active match as the target player' };
      }

      // Check if both players are on the same team (only allow kicking teammates)
      if (initiatorTeam.id !== targetTeam.id) {
        return { success: false, message: 'You can only vote to kick players on your own team' };
      }

      // Check if there's already an active vote kick for this player
      const existingVoteKick = await this.storage.getActiveVoteKick(
        matchWithBothPlayers.id,
        targetId
      );

      if (existingVoteKick) {
        return { 
          success: false, 
          message: 'There is already an active vote kick for this player'
        };
      }

      // Create a new vote kick
      const voteKick = await this.storage.createVoteKick({
        matchId: matchWithBothPlayers.id,
        targetPlayerId: targetId,
        initiatorPlayerId: initiatorId,
        status: 'PENDING'
      });

      // Add initiator's vote
      await this.storage.addVoteKickVote({
        voteKickId: voteKick.id,
        playerId: initiatorId,
        approve: true
      });

      // Get vote system settings from config
      const botConfig = await this.storage.getBotConfig();
      const voteSettings = botConfig.matchRules.voteSystemSettings;

      // Get total team size
      const teamPlayers = initiatorTeam.players;
      // Calculate required votes based on majority percentage from config
      const requiredVotes = Math.max(
        voteSettings.minVotesNeeded,
        Math.ceil(teamPlayers.length * (voteSettings.majorityPercent / 100))
      );

      // Create voting message
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle(`Vote Kick: ${target.username}`)
        .setDescription(`<@${initiator.discordId}> has initiated a vote to kick <@${target.discordId}> from the match.`)
        .addFields(
          { name: 'Match', value: `#${matchWithBothPlayers.id}`, inline: true },
          { name: 'Team', value: initiatorTeam.name, inline: true },
          { name: 'Votes Required', value: `1/${requiredVotes}`, inline: true }
        )
        .setFooter({ text: 'Type "yes" or "no" in this channel to vote' })
        .setTimestamp();

      // Try to find the match channel
      const matchChannel = interaction.guild?.channels.cache.find(
        channel => channel.name === `match-${matchWithBothPlayers.id}`
      );

      if (matchChannel && matchChannel.isTextBased()) {
        await matchChannel.send({ 
          content: teamPlayers.map(p => `<@${p.discordId}>`).join(' '),
          embeds: [embed]
        });
      } else {
        // If no match channel, reply in the command channel
        await interaction.channel?.send({ embeds: [embed] });
      }

      // Handle vote collection and processing would be done in a message event handler
      // That part is not implemented here but would be added to bot/index.ts

      // Log the vote kick initiation
      await this.logEvent(
        "Vote Kick Initiated",
        `<@${initiator.discordId}> has initiated a vote to kick <@${target.discordId}> from match #${matchWithBothPlayers.id}.`,
        [
          { name: 'Match ID', value: matchWithBothPlayers.id.toString(), inline: true },
          { name: 'Team', value: initiatorTeam.name, inline: true },
          { name: 'Required Votes', value: requiredVotes.toString(), inline: true },
          { name: 'Initiator', value: initiator.username, inline: true },
          { name: 'Target', value: target.username, inline: true }
        ]
      );

      return { 
        success: true, 
        message: 'Vote kick initiated. Team members can now vote by typing "yes" or "no".'
      };
    } catch (error) {
      logger.error(`Error initiating vote kick: ${error}`);
      return { success: false, message: 'Failed to initiate vote kick due to an error' };
    }
  }

  async cancelMatch(matchId: number): Promise<{ success: boolean; message: string }> {
    try {
      const match = await this.storage.getMatch(matchId);

      if (!match) {
        return { success: false, message: 'Match not found' };
      }

      if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
        return { success: false, message: `Match is already ${match.status.toLowerCase()}` };
      }

      // Get match players before updating status
      const teams = await this.storage.getMatchTeams(matchId);
      const players = teams.flatMap(team => team.players);

      // Update match status
      await this.storage.updateMatch(matchId, { 
        status: 'CANCELLED',
        finishedAt: new Date()
      });

      // Delete Discord channel
      try {
        const client = getDiscordClient();
        if (client) {
          const guild = client.guilds.cache.first();
          if (guild) {
            const matchChannel = guild.channels.cache.find(
              channel => channel.name === `match-${matchId}`
            );
            if (matchChannel) {
              await matchChannel.delete();
            }
          }
        }
      } catch (error) {
        logger.error(`Error deleting match channel: ${error}`);
      }

      // Return players to queue
      for (const player of players) {
        await this.storage.addPlayerToQueue({
          playerId: player.id,
          priority: 0
        });
      }

      // Log the cancellation
      await this.logEvent("Match Cancelled", `Match #${matchId} has been cancelled.`, [
        { name: 'Match ID', value: matchId.toString(), inline: true },
        { name: 'Players Returned', value: players.length.toString(), inline: true }
      ]);

      return { 
        success: true, 
        message: `Match #${matchId} cancelled. ${players.length} players returned to queue.`
      };
    } catch (error) {
      logger.error(`Error cancelling match: ${error}`);
      return { success: false, message: 'Failed to cancel match due to an error' };
    }
  }

  private internalLogEvent = async (title: string, description: string, fields: Array<{ name: string; value: string; inline?: boolean }>) => 
  {
    try 
    {
      // Implement logging logic here
      logger.info(`${title}: ${description}`);
    } catch (error) 
    {
      logger.error(`Failed to log event: ${error}`);
    }
  }
}