// src/services/QueueService.ts

import { Collection, User, EmbedBuilder, TextChannel } from "discord.js";
import { BotClient } from "../types/client";
import { Player } from "../models/Player";
import { Match } from "../models/Match";

// (Keep the ActiveMatch interface and the rest of the class structure as before)
interface ActiveMatch {
    team1: User[];
    team2: User[];
}

export class QueueService {
    public client: BotClient;
    public queue: Collection<string, User>;
    public activeMatches: Collection<number, ActiveMatch>;
    private usersInActiveMatch: Set<string>;

    constructor(client: BotClient) {
        this.client = client;
        this.queue = new Collection<string, User>();
        this.activeMatches = new Collection<number, ActiveMatch>();
        this.usersInActiveMatch = new Set<string>();
        this.client.logger.info("[QueueService] Initialized.");
    }

    // --- Queue Management ---
    // (addToQueue, removeFromQueue, getQueue methods remain the same)
    async addToQueue(
        user: User,
    ): Promise<{ success: boolean; message: string }> {
        if (this.queue.has(user.id)) {
            return { success: false, message: "You are already in the queue." };
        }

        if (this.usersInActiveMatch.has(user.id)) {
            return {
                success: false,
                message: "You are currently in an active match.",
            };
        }

        // Double-check DB state
        const currentMatch = await this.client.db.findPlayerCurrentMatch(
            user.id,
        );
        if (currentMatch) {
            this.client.logger.warn(
                `[QueueService] User ${user.tag} tried to join queue but is in active DB match ${currentMatch.id}. Re-syncing state.`,
            );
            this.usersInActiveMatch.add(user.id);
            return {
                success: false,
                message: `You are already in an active match (ID: ${currentMatch.id}). Report the result or have it cancelled.`,
            };
        }

        // Ensure player exists in DB
        await this.client.db.findOrCreatePlayer(user);

        this.queue.set(user.id, user);
        this.client.logger.info(
            `[QueueService] User ${user.tag} (ID: ${user.id}) joined queue. Size: ${this.queue.size}`,
        );
        await this.checkQueue(); // Check queue after adding
        return { success: true, message: "You have been added to the queue." };
    }

    removeFromQueue(userId: string): { success: boolean; message: string } {
        if (!this.queue.has(userId)) {
            return { success: false, message: "You are not in the queue." };
        }

        const user = this.queue.get(userId);
        this.queue.delete(userId);
        this.client.logger.info(
            `[QueueService] User ${user?.tag ?? userId} left queue. Size: ${this.queue.size}`,
        );
        return { success: true, message: "You have left the queue." };
    }

    getQueue(): User[] {
        return Array.from(this.queue.values());
    }

    // --- Match Creation & Balancing ---
    // (checkQueue, createMatch, balanceTeams methods remain the same as the ELO balancing version)
    async checkQueue(): Promise<void> {
        const requiredPlayers = this.client.config.teamSize * 2;
        if (this.queue.size >= requiredPlayers) {
            this.client.logger.info(
                `[QueueService] Queue full (${this.queue.size}/${requiredPlayers}). Creating match...`,
            );

            const playersForMatch = Array.from(this.queue.values()).slice(
                0,
                requiredPlayers,
            );
            const playerIds = playersForMatch.map((p) => p.id);

            // Remove selected players from queue immediately
            playerIds.forEach((id) => this.queue.delete(id));
            this.client.logger.info(
                `[QueueService] Selected players: ${playersForMatch.map((p) => p.tag).join(", ")}. Queue size now: ${this.queue.size}`,
            );

            try {
                // Attempt to create the match (includes balancing)
                await this.createMatch(playersForMatch);
            } catch (error: any) {
                this.client.logger.error(
                    `[QueueService] Failed to create match: ${error?.message || error}`,
                );
                this.client.logger.info(
                    "[QueueService] Re-adding players to queue due to match creation failure.",
                );
                // Re-queue players on failure
                playersForMatch.forEach((p) => {
                    if (!this.usersInActiveMatch.has(p.id)) {
                        // Avoid re-adding if somehow marked active
                        this.queue.set(p.id, p);
                    } else {
                        this.client.logger.warn(
                            `[QueueService] Did not re-queue ${p.tag} as they are marked in an active match.`,
                        );
                    }
                });

                // Notify failure
                const announceChannel = await this.getAnnouncementChannel();
                if (announceChannel) {
                    announceChannel
                        .send({
                            embeds: [
                                this.client.embeds.error(
                                    "Failed to create match. Players have been re-queued.",
                                ),
                            ],
                        })
                        .catch((e) =>
                            this.client.logger.error(
                                `[QueueService] Failed to send match creation error embed: ${e}`,
                            ),
                        );
                }
            }
        }
    }

    async createMatch(players: User[]): Promise<void> {
        // 1. Balance Teams (Now ELO-based)
        const [team1, team2] = await this.balanceTeams(players);

        // Check if balancing was successful
        if (team1.length === 0 || team2.length === 0) {
            this.client.logger.error(
                "[QueueService] Team balancing failed, aborting match creation.",
            );
            // Throw error to be caught by checkQueue for player re-queuing
            throw new Error("Team balancing returned empty or invalid teams.");
        }
        this.client.logger.info(`[QueueService] Teams balanced successfully.`);

        // 2. Create Match in DB
        const match = await this.client.db.createMatch("ongoing");
        if (!match) {
            this.client.logger.error(
                "[QueueService] Failed to create match entry in database.",
            );
            throw new Error("Database error: Failed to create match entry.");
        }
        this.client.logger.info(
            `[QueueService] Match ${match.id} created in database.`,
        );

        // 3. Add Participants to DB & Update State
        const participantPromises: Promise<any>[] = [];
        players.forEach((p) => {
            const teamNumber = team1.some((tm) => tm.id === p.id) ? 1 : 2;
            participantPromises.push(
                this.client.db.addMatchParticipant(match.id, p.id, teamNumber),
            );
            this.usersInActiveMatch.add(p.id); // Mark user as in an active match
        });

        try {
            await Promise.all(participantPromises);
            this.client.logger.info(
                `[QueueService] Participants added for match ${match.id}.`,
            );
        } catch (dbError) {
            this.client.logger.error(
                `[QueueService] Failed to add participants for match ${match.id}: ${dbError}`,
            );
            // Cleanup attempt: Remove users from active set, potentially delete the match row if possible
            players.forEach((p) => this.usersInActiveMatch.delete(p.id));
            // Consider adding: await this.client.db.deleteMatch(match.id); (if you implement deleteMatch)
            throw new Error(
                "Database error: Failed to add match participants.",
            );
        }

        // 4. Store Active Match in Memory
        this.activeMatches.set(match.id, { team1, team2 });
        this.client.logger.debug(
            `[QueueService] Match ${match.id} added to active matches collection.`,
        );

        // 5. Announce Match
        const announceChannel = await this.getAnnouncementChannel();
        if (announceChannel) {
            // Ensure you have an embed helper like this
            const embed = this.client.embeds.matchFound(match.id, team1, team2);
            const mentions = players.map((p) => p.toString()).join(" ");
            try {
                await announceChannel.send({
                    content: `⚔️ Match #${match.id} Found! ${mentions}`,
                    embeds: [embed],
                });
                this.client.logger.info(
                    `[QueueService] Match ${match.id} announced in #${announceChannel.name}.`,
                );
            } catch (sendError) {
                this.client.logger.error(
                    `[QueueService] Failed to send announcement for match ${match.id}: ${sendError}`,
                );
            }
        } else {
            this.client.logger.warn(
                `[QueueService] Match announcement channel not found/configured. Match ${match.id} not announced.`,
            );
        }
    }

    async balanceTeams(players: User[]): Promise<[User[], User[]]> {
        const teamSize = this.client.config.teamSize;
        const requiredPlayers = teamSize * 2;
        const defaultElo = this.client.config.elo.default;
        const logger = this.client.logger; // Convenience reference

        // Basic validation
        if (!players || players.length !== requiredPlayers) {
            logger.error(
                `[QueueService] balanceTeams Error: Expected ${requiredPlayers} players, received ${players?.length ?? 0}.`,
            );
            return [[], []];
        }
        if (teamSize <= 0) {
            logger.error(
                `[QueueService] balanceTeams Error: Invalid teamSize (${teamSize}) configured.`,
            );
            return [[], []];
        }

        logger.info(
            `[QueueService] Balancing teams for ${players.length} players...`,
        );

        // 1. Fetch ELO for all players concurrently
        let playerDataWithElo: { user: User; elo: number }[];
        try {
            const playerDbDataPromises = players.map((p) =>
                this.client.db.findPlayer(p.id),
            );
            const results = await Promise.all(playerDbDataPromises);

            playerDataWithElo = players.map((player, index) => {
                const dbPlayer = results[index];
                const elo = dbPlayer ? dbPlayer.elo : defaultElo;
                if (!dbPlayer) {
                    logger.warn(
                        `[QueueService] balanceTeams: Player ${player.tag} (ID: ${player.id}) not found in DB. Using default ELO ${defaultElo}. Consider registering.`,
                    );
                    // Optionally auto-register: await this.client.db.registerPlayer(player, defaultElo);
                }
                return { user: player, elo: elo };
            });
        } catch (error) {
            logger.error(
                `[QueueService] balanceTeams DB Error: Failed fetching player data: ${error}`,
            );
            return [[], []]; // Return empty on DB error
        }

        // Log fetched ELOs
        logger.debug(
            `[QueueService] balanceTeams Player ELOs: ${JSON.stringify(playerDataWithElo.map((p) => ({ tag: p.user.tag, elo: p.elo })))}`,
        );

        // 2. Sort players by ELO (descending)
        playerDataWithElo.sort((a, b) => b.elo - a.elo); // Highest ELO first

        // 3. Greedy assignment algorithm
        const team1: User[] = [];
        const team2: User[] = [];
        let eloSum1 = 0;
        let eloSum2 = 0;

        for (const pInfo of playerDataWithElo) {
            // Assign to the team with the lower current ELO sum
            if (eloSum1 <= eloSum2) {
                team1.push(pInfo.user);
                eloSum1 += pInfo.elo;
            } else {
                team2.push(pInfo.user);
                eloSum2 += pInfo.elo;
            }
        }

        // 4. Post-assignment validation (CRITICAL)
        if (team1.length !== teamSize || team2.length !== teamSize) {
            logger.error(
                `[QueueService] balanceTeams FATAL Error: Balancing resulted in incorrect team sizes! T1=${team1.length}, T2=${team2.length} (Expected ${teamSize}). Aborting.`,
            );
            logger.debug(
                `[QueueService] balanceTeams Debug Info: Input Players = ${players.map((p) => p.tag)}, Sorted ELOs = ${JSON.stringify(playerDataWithElo.map((p) => ({ tag: p.user.tag, elo: p.elo })))}`,
            );
            return [[], []]; // Return empty teams signifies failure
        }

        // 5. Log results and return
        const team1Tags = team1.map((p) => p.tag).join(", ");
        const team2Tags = team2.map((p) => p.tag).join(", ");
        logger.info(
            `[QueueService] Team balancing complete. T1 (${team1.length}) ELO: ${eloSum1} [${team1Tags}] | T2 (${team2.length}) ELO: ${eloSum2} [${team2Tags}]. Diff: ${Math.abs(eloSum1 - eloSum2)}`,
        );

        return [team1, team2];
    }

    // --- Match Resolution ---

    // (processMatchResult remains largely the same, calling the updated _updateElo)
    async processMatchResult(
        matchId: number,
        winningTeam: 1 | 2 | null /* null means cancelled */,
    ): Promise<boolean> {
        const logger = this.client.logger;
        logger.info(
            `[QueueService] Processing result for match ${matchId}. Winner: ${winningTeam === null ? "Cancelled" : `Team ${winningTeam}`}`,
        );

        const activeMatchData = this.activeMatches.get(matchId);
        let team1Users: User[] | undefined;
        let team2Users: User[] | undefined;

        if (activeMatchData) {
            team1Users = activeMatchData.team1;
            team2Users = activeMatchData.team2;
        } else {
            logger.warn(
                `[QueueService] Match ${matchId} not in active memory. Checking DB...`,
            );
            const dbMatch =
                await this.client.db.findMatchWithParticipants(matchId); // Needs implementation in DB Manager
            if (!dbMatch || dbMatch.status !== "ongoing") {
                logger.error(
                    `[QueueService] Cannot process result: Match ${matchId} not found in DB or not 'ongoing'.`,
                );
                return false;
            }
            if (!dbMatch.participants || dbMatch.participants.length === 0) {
                logger.error(
                    `[QueueService] Match ${matchId} found in DB but has no participants listed. Cannot process ELO/Stats.`,
                );
                // Update status only
                await this.client.db.updateMatch(
                    matchId,
                    winningTeam === null ? "cancelled" : "completed",
                    winningTeam,
                );
                return true; // Partial success
            }

            // Attempt to fetch User objects for ELO update (might fail if users left server)
            logger.warn(
                `[QueueService] Attempting to fetch users for DB match ${matchId} for ELO/stats...`,
            );
            const participantIds = dbMatch.participants.map((p) => p.discordId);
            try {
                const fetchedUsers = await Promise.all(
                    participantIds.map((id) => this.client.users.fetch(id)),
                );
                // Reconstruct teams based on DB data
                team1Users = fetchedUsers.filter((u) =>
                    dbMatch.participants.find(
                        (p) => p.discordId === u.id && p.team === 1,
                    ),
                );
                team2Users = fetchedUsers.filter((u) =>
                    dbMatch.participants.find(
                        (p) => p.discordId === u.id && p.team === 2,
                    ),
                );
                logger.info(
                    `[QueueService] Successfully fetched ${team1Users.length + team2Users.length} users for match ${matchId}.`,
                );
            } catch (fetchError) {
                logger.error(
                    `[QueueService] Failed to fetch all users for match ${matchId} from DB state: ${fetchError}. Skipping ELO/stats update.`,
                );
                team1Users = undefined;
                team2Users = undefined;
            }
        }

        // Update ELOs (only if a winner is declared and we have team data)
        let eloUpdated = false;
        if (
            winningTeam !== null &&
            team1Users &&
            team2Users &&
            team1Users.length > 0 &&
            team2Users.length > 0
        ) {
            try {
                await this._updateElo(
                    matchId,
                    team1Users,
                    team2Users,
                    winningTeam,
                );
                eloUpdated = true;
            } catch (eloError) {
                logger.error(
                    `[QueueService] Error during ELO update for match ${matchId}: ${eloError}`,
                );
                // Continue processing other parts (stats, status)
            }
        } else if (winningTeam !== null) {
            logger.warn(
                `[QueueService] Skipping ELO update for match ${matchId} due to missing team data or non-win/loss outcome.`,
            );
        }

        // Update DB: Match Status & Winner
        const status = winningTeam === null ? "cancelled" : "completed";
        await this.client.db.updateMatch(matchId, status, winningTeam);

        // Update DB: Player Stats (Wins/Losses) - only if winner declared and teams known
        let statsUpdated = false;
        if (
            winningTeam !== null &&
            team1Users &&
            team2Users &&
            team1Users.length > 0 &&
            team2Users.length > 0
        ) {
            try {
                if (winningTeam === 1) {
                    await this.client.db.updatePlayerStats(
                        team1Users.map((u) => u.id),
                        team2Users.map((u) => u.id),
                    );
                    statsUpdated = true;
                } else if (winningTeam === 2) {
                    await this.client.db.updatePlayerStats(
                        team2Users.map((u) => u.id),
                        team1Users.map((u) => u.id),
                    );
                    statsUpdated = true;
                }
            } catch (statsError) {
                logger.error(
                    `[QueueService] Error updating player stats for match ${matchId}: ${statsError}`,
                );
            }
        } else if (winningTeam !== null) {
            logger.warn(
                `[QueueService] Skipping player stats update for match ${matchId} due to missing team data.`,
            );
        }

        // Clean up in-memory state
        if (this.activeMatches.has(matchId)) {
            const removedMatch = this.activeMatches.get(matchId);
            this.activeMatches.delete(matchId);
            // Use the teams from the removed match data for cleanup
            if (removedMatch) {
                removedMatch.team1.forEach((p) =>
                    this.usersInActiveMatch.delete(p.id),
                );
                removedMatch.team2.forEach((p) =>
                    this.usersInActiveMatch.delete(p.id),
                );
            } else if (team1Users && team2Users) {
                // Fallback: use fetched users if possible (less reliable if some failed fetch)
                team1Users.forEach((p) => this.usersInActiveMatch.delete(p.id));
                team2Users.forEach((p) => this.usersInActiveMatch.delete(p.id));
            }
            logger.info(
                `[QueueService] Match ${matchId} removed from active matches collection.`,
            );
        }

        // Announce result
        const resultChannel = await this.getResultChannel();
        if (resultChannel && team1Users && team2Users) {
            // Announce if we have team data
            try {
                // Pass new ELOs to the embed function if desired (requires fetching them post-update)
                // For simplicity, we'll use the embed function as is for now.
                const embed = this.client.embeds.matchResult(
                    matchId,
                    winningTeam,
                    team1Users,
                    team2Users,
                    status,
                    eloUpdated,
                    statsUpdated,
                ); // Modify embeds.matchResult if needed
                await resultChannel.send({ embeds: [embed] });
            } catch (e) {
                logger.error(
                    `[QueueService] Error sending result embed for ${matchId}: ${e}`,
                );
            }
        } else if (resultChannel) {
            logger.warn(
                `[QueueService] Result channel found, but cannot announce full results for ${matchId} due to missing team data.`,
            );
            try {
                await resultChannel.send(
                    `Match #${matchId} has been **${status}**.`,
                );
            } catch (e) {}
        } else {
            logger.warn(
                `[QueueService] Match result channel not configured/found. Result for ${matchId} not announced.`,
            );
        }

        return true;
    }

    /**
     * Calculates and updates player ELOs based on match outcome.
     */
    async _updateElo(
        matchId: number,
        team1Users: User[],
        team2Users: User[],
        winningTeam: 1 | 2,
    ): Promise<void> {
        const logger = this.client.logger;
        const kFactor = this.client.config.elo.kFactor; // Get K-Factor from config
        const defaultElo = this.client.config.elo.default; // Get default ELO

        if (!kFactor || kFactor <= 0) {
            logger.error(
                `[QueueService] _updateElo Error: Invalid K-Factor (${kFactor}) configured. Skipping ELO update for match ${matchId}.`,
            );
            return;
        }
        if (team1Users.length === 0 || team2Users.length === 0) {
            logger.error(
                `[QueueService] _updateElo Error: Cannot update ELO for match ${matchId} with empty teams.`,
            );
            return;
        }

        logger.info(
            `[QueueService] Calculating ELO changes for match ${matchId} (K=${kFactor})...`,
        );

        // 1. Fetch current ELO for all players involved
        const allUsers = [...team1Users, ...team2Users];
        let playersData: Player[]; // Assuming Player model has `discordId` and `elo`
        try {
            const results = await Promise.all(
                allUsers.map((u) => this.client.db.findPlayer(u.id)),
            );
            // Filter out nulls and ensure we have data for everyone, using default if needed
            playersData = allUsers.map((user, index) => {
                const dbPlayer = results[index];
                if (dbPlayer) return dbPlayer;
                // Player missing from DB mid-match? Highly unlikely but handle defensively.
                logger.warn(
                    `[QueueService] _updateElo: Player ${user.tag} (ID: ${user.id}) not found in DB during ELO update for match ${matchId}. Using default ELO ${defaultElo}.`,
                );
                // Return a temporary structure matching the Player model enough for calculation
                return {
                    discordId: user.id,
                    elo: defaultElo,
                    wins: 0,
                    losses: 0,
                } as Player; // Cast needed if structure differs significantly
            });
        } catch (dbError) {
            logger.error(
                `[QueueService] _updateElo DB Error: Failed fetching player data for match ${matchId}: ${dbError}. Aborting ELO update.`,
            );
            throw dbError; // Re-throw to signal failure upstream if necessary
        }

        const team1Data = playersData.filter((p) =>
            team1Users.some((u) => u.id === p.discordId),
        );
        const team2Data = playersData.filter((p) =>
            team2Users.some((u) => u.id === p.discordId),
        );

        // Safety check after filtering
        if (
            team1Data.length !== team1Users.length ||
            team2Data.length !== team2Users.length
        ) {
            logger.error(
                `[QueueService] _updateElo Error: Mismatch between User list and fetched Player data for match ${matchId}. Aborting ELO update.`,
            );
            logger.debug(
                `T1 Users: ${team1Users.length}, T1 Data: ${team1Data.length} | T2 Users: ${team2Users.length}, T2 Data: ${team2Data.length}`,
            );
            return; // Avoid proceeding with incomplete data
        }

        // 2. Calculate Average ELO for each team
        const avgElo1 =
            team1Data.reduce((sum, p) => sum + p.elo, 0) / team1Data.length;
        const avgElo2 =
            team2Data.reduce((sum, p) => sum + p.elo, 0) / team2Data.length;
        logger.debug(
            `[QueueService] Match ${matchId} Avg ELOs - T1: ${avgElo1.toFixed(2)}, T2: ${avgElo2.toFixed(2)}`,
        );

        // 3. Calculate Expected Scores
        const expectedScore1 =
            1 / (1 + Math.pow(10, (avgElo2 - avgElo1) / 400));
        const expectedScore2 = 1 - expectedScore1; // Or 1 / (1 + Math.pow(10, (avgElo1 - avgElo2) / 400))
        logger.debug(
            `[QueueService] Match ${matchId} Expected Scores - T1: ${expectedScore1.toFixed(4)}, T2: ${expectedScore2.toFixed(4)}`,
        );

        // 4. Determine Actual Scores
        const actualScore1 = winningTeam === 1 ? 1 : 0;
        const actualScore2 = winningTeam === 2 ? 1 : 0; // Or 1 - actualScore1
        logger.debug(
            `[QueueService] Match ${matchId} Actual Scores - T1: ${actualScore1}, T2: ${actualScore2}`,
        );

        // 5. Calculate ELO changes and prepare updates
        const eloUpdatePromises: Promise<any>[] = [];
        const newEloValues = new Map<string, number>(); // Store new ELOs for logging/embeds

        team1Data.forEach((player) => {
            const eloChange = kFactor * (actualScore1 - expectedScore1);
            const newElo = Math.round(player.elo + eloChange);
            logger.debug(
                `[QueueService] ELO Change T1 ${player.discordId}: ${player.elo} -> ${newElo} (${eloChange >= 0 ? "+" : ""}${eloChange.toFixed(2)})`,
            );
            newEloValues.set(player.discordId, newElo);
            eloUpdatePromises.push(
                this.client.db.setPlayerElo(player.discordId, newElo),
            );
        });

        team2Data.forEach((player) => {
            const eloChange = kFactor * (actualScore2 - expectedScore2);
            const newElo = Math.round(player.elo + eloChange);
            logger.debug(
                `[QueueService] ELO Change T2 ${player.discordId}: ${player.elo} -> ${newElo} (${eloChange >= 0 ? "+" : ""}${eloChange.toFixed(2)})`,
            );
            newEloValues.set(player.discordId, newElo);
            eloUpdatePromises.push(
                this.client.db.setPlayerElo(player.discordId, newElo),
            );
        });

        // 6. Execute all database updates
        try {
            await Promise.all(eloUpdatePromises);
            logger.info(
                `[QueueService] Successfully updated ELOs for ${eloUpdatePromises.length} players in match ${matchId}.`,
            );
        } catch (updateError) {
            logger.error(
                `[QueueService] _updateElo DB Error: Failed to update one or more player ELOs for match ${matchId}: ${updateError}. Some players may have outdated ELO.`,
            );
            // Decide if you want to re-throw or just log. Logging is often sufficient.
            // throw updateError; // Optional: Signal failure more strongly
        }

        // Optional: Pass newEloValues map to processMatchResult if the embed needs to show ELO changes
    }

    // --- Helper Methods ---
    // (_fetchTextChannel, getAnnouncementChannel, getResultChannel methods remain the same)
    async getAnnouncementChannel(): Promise<TextChannel | null> {
        const channelId = this.client.config.channels?.matchAnnouncements;
        return this._fetchTextChannel(channelId, "Announcement");
    }

    async getResultChannel(): Promise<TextChannel | null> {
        const channelId = this.client.config.channels?.matchResults;
        // Fallback to announcement channel if result channel isn't specified
        return this._fetchTextChannel(
            channelId || this.client.config.channels?.matchAnnouncements,
            "Result/Announcement",
        );
    }

    private async _fetchTextChannel(
        channelId: string | undefined,
        type: string,
    ): Promise<TextChannel | null> {
        if (!channelId) {
            // this.client.logger.warn(`[QueueService] ${type} channel ID not configured.`);
            return null;
        }
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (channel instanceof TextChannel) {
                return channel;
            } else {
                this.client.logger.warn(
                    `[QueueService] Configured ${type} channel (${channelId}) is not a TextChannel.`,
                );
                return null;
            }
        } catch (error) {
            this.client.logger.error(
                `[QueueService] Failed to fetch ${type} channel (${channelId}): ${error}`,
            );
            return null;
        }
    }

    // --- Admin Command Integrations ---
    // (forceMatchResult, removePlayerCleanup methods remain the same)
    async forceMatchResult(
        matchId: number,
        winningTeam: 1 | 2 | null,
    ): Promise<boolean> {
        this.client.logger.info(
            `[QueueService] Admin force result for match ${matchId}. Winner: ${winningTeam === null ? "Cancelled" : `Team ${winningTeam}`}`,
        );
        // Added complexity in processMatchResult to handle DB state, this call remains simple
        return this.processMatchResult(matchId, winningTeam);
    }

    removePlayerCleanup(userId: string): void {
        const wasInQueue = this.queue.delete(userId);
        const wasInActiveSet = this.usersInActiveMatch.delete(userId);
        if (wasInQueue || wasInActiveSet) {
            this.client.logger.info(
                `[QueueService] Cleaned up state for removed user ${userId}. In Queue: ${wasInQueue}, In Active Set: ${wasInActiveSet}`,
            );
        }
    }
}
