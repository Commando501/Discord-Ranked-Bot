// src/services/QueueService.ts

import { Collection, User, EmbedBuilder, TextChannel } from "discord.js";
import { BotClient } from "../types/client"; // Ensure this path is correct
import { Player } from "../models/Player"; // Ensure this path is correct
import { Match } from "../models/Match"; // Ensure this path is correct

// Define a type for the active match structure
interface ActiveMatch {
    team1: User[];
    team2: User[];
    // Add other relevant properties if needed (e.g., report tracking)
}

export class QueueService {
    public client: BotClient;
    public queue: Collection<string, User>; // User ID -> User Object
    public activeMatches: Collection<number, ActiveMatch>; // Match ID -> ActiveMatch details
    private usersInActiveMatch: Set<string>; // Tracks users in matches known to this instance

    constructor(client: BotClient) {
        this.client = client;
        this.queue = new Collection<string, User>();
        this.activeMatches = new Collection<number, ActiveMatch>();
        this.usersInActiveMatch = new Set<string>();
        // TODO: Consider loading 'ongoing' matches from DB on startup
        // to repopulate activeMatches and usersInActiveMatch for better restart recovery.
        this.client.logger.info("[QueueService] Initialized.");
    }

    // --- Queue Management ---

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

    /**
     * Balances teams based on player ELO using a greedy algorithm.
     * Fetches ELO, sorts players, assigns them to teams minimizing ELO difference.
     * @returns A tuple containing two arrays of Users: [team1, team2]. Returns [[], []] on failure.
     */
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

    // --- Match Resolution --- (Includes placeholder for ELO update)

    async processMatchResult(
        matchId: number,
        winningTeam: 1 | 2 | null /* null means cancelled */,
    ): Promise<boolean> {
        const logger = this.client.logger;
        logger.info(
            `[QueueService] Processing result for match ${matchId}. Winner: ${winningTeam === null ? "Cancelled" : `Team ${winningTeam}`}`,
        );

        const activeMatchData = this.activeMatches.get(matchId);
        let team1: User[] | undefined;
        let team2: User[] | undefined;

        if (activeMatchData) {
            team1 = activeMatchData.team1;
            team2 = activeMatchData.team2;
        } else {
            logger.warn(
                `[QueueService] Match ${matchId} not in active memory. Checking DB...`,
            );
            const dbMatch = await this.client.db.findMatch(matchId);
            if (!dbMatch || dbMatch.status !== "ongoing") {
                logger.error(
                    `[QueueService] Cannot process result: Match ${matchId} not found in DB or not 'ongoing'.`,
                );
                return false;
            }
            // Cannot update ELO if not in memory, as we lack player lists easily.
            logger.warn(
                `[QueueService] Match ${matchId} found in DB but not memory. ELO update will be skipped.`,
            );
        }

        // Update ELOs (only if a winner is declared and we have team data)
        if (winningTeam !== null && team1 && team2) {
            await this._updateElo(matchId, team1, team2, winningTeam);
        } else if (winningTeam !== null && (!team1 || !team2)) {
            logger.warn(
                `[QueueService] Skipping ELO update for match ${matchId} due to missing team data in memory.`,
            );
        }

        // Update DB: Match Status & Winner
        const status = winningTeam === null ? "cancelled" : "completed";
        await this.client.db.updateMatch(matchId, status, winningTeam);

        // Update DB: Player Stats (Wins/Losses) - only if winner declared and teams known
        if (winningTeam === 1 && team1 && team2) {
            await this.client.db.updatePlayerStats(
                team1.map((u) => u.id),
                team2.map((u) => u.id),
            );
        } else if (winningTeam === 2 && team1 && team2) {
            await this.client.db.updatePlayerStats(
                team2.map((u) => u.id),
                team1.map((u) => u.id),
            );
        } else if (winningTeam !== null && (!team1 || !team2)) {
            logger.warn(
                `[QueueService] Skipping player stats update for match ${matchId} due to missing team data in memory.`,
            );
        }

        // Clean up in-memory state
        if (this.activeMatches.has(matchId)) {
            this.activeMatches.delete(matchId);
            if (team1)
                team1.forEach((p) => this.usersInActiveMatch.delete(p.id));
            if (team2)
                team2.forEach((p) => this.usersInActiveMatch.delete(p.id));
            logger.info(
                `[QueueService] Match ${matchId} removed from active matches.`,
            );
        }

        // Announce result
        const resultChannel = await this.getResultChannel();
        if (resultChannel && team1 && team2) {
            // Only announce if we can show teams
            try {
                const embed = this.client.embeds.matchResult(
                    matchId,
                    winningTeam,
                    team1,
                    team2,
                    status,
                );
                await resultChannel.send({ embeds: [embed] });
            } catch (e) {
                logger.error(
                    `[QueueService] Error sending result embed for ${matchId}: ${e}`,
                );
            }
        } else if (resultChannel && (!team1 || !team2)) {
            logger.warn(
                `[QueueService] Result channel found, but cannot announce full results for ${matchId} due to missing team data.`,
            );
            // Send a basic notification?
            try {
                await resultChannel.send(
                    `Match #${matchId} has been ${status}.`,
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
     * TODO: Implement the actual Elo rating calculation logic here.
     */
    async _updateElo(
        matchId: number,
        team1: User[],
        team2: User[],
        winningTeam: 1 | 2,
    ): Promise<void> {
        this.client.logger.warn(
            `[QueueService] _updateElo called for match ${matchId} (Winner: Team ${winningTeam}) - ELO CALCULATION IS NOT IMPLEMENTED.`,
        );

        // --- START ELO IMPLEMENTATION HERE ---
        // 1. Fetch Player objects (with ELO) from DB for all participants using team1/team2 user IDs.
        //    Use Promise.all and this.client.db.findPlayer. Handle missing players.
        // 2. Calculate average ELO for each team (or prepare for player-vs-player if 1v1).
        // 3. Calculate the expected score for Team 1 (E_A) using the Elo formula:
        //    E_A = 1 / (1 + 10^((AvgElo_B - AvgElo_A) / 400))
        // 4. Determine the actual score for Team 1 (S_A): 1 for win, 0 for loss (0.5 for draw if supported).
        // 5. For each player on Team 1, calculate their new ELO:
        //    NewElo = OldElo + K * (S_A - E_A)
        //    (K is the K-factor from config: this.client.config.elo.kFactor)
        // 6. Do the same for Team 2 (using S_B = 1 - S_A and E_B = 1 - E_A).
        // 7. Round the new ELO values.
        // 8. Update the ELO for each player in the database using Promise.all and this.client.db.setPlayerElo.
        // 9. Add logging for ELO changes.
        // --- END ELO IMPLEMENTATION ---
    }

    // --- Helper Methods ---

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

    // Method called by admin commands to force a result
    async forceMatchResult(
        matchId: number,
        winningTeam: 1 | 2 | null,
    ): Promise<boolean> {
        this.client.logger.info(
            `[QueueService] Admin force result for match ${matchId}. Winner: ${winningTeam === null ? "Cancelled" : `Team ${winningTeam}`}`,
        );
        return this.processMatchResult(matchId, winningTeam);
    }

    // Clean up state if an admin removes a player
    removePlayerCleanup(userId: string): void {
        const wasInQueue = this.queue.delete(userId);
        const wasInActiveSet = this.usersInActiveMatch.delete(userId);
        if (wasInQueue || wasInActiveSet) {
            this.client.logger.info(
                `[QueueService] Cleaned up state for removed user ${userId}. In Queue: ${wasInQueue}, In Active Set: ${wasInActiveSet}`,
            );
        }
        // Note: This doesn't automatically cancel matches the user might be in.
        // Consider adding logic or instructions for admins to cancel related matches.
    }
}
