import { Guild } from "discord.js";
import { IStorage } from "../../storage";
import { logger } from "../utils/logger";
import { MatchService } from "./matchService";
import { BotConfig } from "@shared/botConfig";
import { getBot as getDiscordBot } from "../../index.bot";
import { db } from "../../db";
import { eq, inArray } from "drizzle-orm";
import { queue } from "@shared/schema";

export class QueueService {
    private storage: IStorage;
    private matchService: MatchService;
    private queueCheckInterval: NodeJS.Timeout | null = null;
    private static instance: QueueService | null = null;

    // Make these accessible to MatchService for queueing players with priorities based on group status
    public playerGroups: Map<string, Map<number, number>> = new Map();
    public currentActiveGroup: string | null = null;

    constructor(storage: IStorage) {
        this.storage = storage;
        this.matchService = new MatchService(storage);

        // Singleton pattern - only start queue check on the first instance
        if (!QueueService.instance) {
            QueueService.instance = this;
            this.startQueueCheck();
            logger.info("QueueService initialized as singleton instance");
        } else {
            logger.info("Using existing QueueService instance");
        }
    }

    // Get singleton instance
    public static getInstance(storage: IStorage): QueueService {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService(storage);
        }
        return QueueService.instance;
    }

    // Track if a queue check is already in progress
    private queueCheckInProgress: boolean = false;

    private async startQueueCheck() {
        // Clear existing interval if any
        if (this.queueCheckInterval) {
            clearInterval(this.queueCheckInterval);
        }

        // Get config first
        const config = await this.storage.getBotConfig();
        const intervalMs =
            config.matchmaking.matchCreationIntervalSeconds * 1000;

        logger.info(`Starting queue check interval: ${intervalMs}ms`);

        // Start new interval
        this.queueCheckInterval = setInterval(async () => {
            // If a check is already in progress, skip this iteration
            if (this.queueCheckInProgress) {
                logger.info("Queue check already in progress, skipping this interval");
                return;
            }

            // Set the check in progress flag
            this.queueCheckInProgress = true;

            try {
                // Get queue size for logging/debugging
                const queueSize = await this.getQueueSize();
                logger.info(
                    `Queue check interval triggered. Current queue size: ${queueSize}`,
                );

                const bot = getDiscordBot();
                const guild = bot?.guilds.cache.first();

                if (guild) {
                    logger.info(
                        "Queue check: Found guild, checking for potential matches",
                    );

                    // Get config for logging
                    const botConfig = await this.storage.getBotConfig();
                    const minPlayersRequired =
                        botConfig.matchmaking.queueSizeLimits.min;

                    if (queueSize >= minPlayersRequired) {
                        logger.info(
                            `Queue has enough players (${queueSize}/${minPlayersRequired}), attempting to create match`,
                        );
                        const matchCreated =
                            await this.checkAndCreateMatch(guild);
                        if (matchCreated) {
                            logger.info(
                                "Successfully created match from queue check interval",
                            );
                        } else {
                            logger.warn(
                                "Failed to create match from queue check interval despite having enough players",
                            );
                        }
                    } else {
                        logger.info(
                            `Not enough players in queue yet (${queueSize}/${minPlayersRequired})`,
                        );
                    }
                } else {
                    logger.warn(
                        "Queue check: No guild available, skipping match creation check",
                    );
                }
            } catch (error) {
                logger.error(`Error in queue check interval: ${error}`);
            } finally {
                // Always release the flag when done
                this.queueCheckInProgress = false;
            }
        }, intervalMs);
    }

    /**
     * Check if a player is in an active match
     * @param playerId The player's ID to check
     * @returns Boolean indicating if player is in an active match
     */
    async isPlayerInActiveMatch(playerId: number): Promise<boolean> {
        try {
            // Get all active matches
            const activeMatches = await this.storage.getActiveMatches();

            // Check if player is in any of the active matches
            for (const match of activeMatches) {
                for (const team of match.teams) {
                    const isInTeam = team.players.some(
                        (player) => player.id === playerId,
                    );
                    if (isInTeam) {
                        logger.info(
                            `Player ${playerId} is in active match #${match.id}`,
                        );
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            logger.error(
                `Error checking if player is in active match: ${error}`,
            );
            // Default to false to allow queueing in case of errors
            return false;
        }
    }

    /**
     * Add a player to the queue with optional priority and group information
     * @param playerId The player ID to add to queue
     * @param priority Optional priority level (higher = prioritized)
     * @param groupId Optional group ID for group tracking
     * @returns Success status and message
     */
    async addPlayerToQueue(
        playerId: number,
        priority: number = 0,
        groupId?: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            // Mark player as being processed to prevent race conditions
            // This prevents the player from being selected for another match while we're adding them to queue
            this.markPlayerAsProcessing(playerId);

            try {
                // Check if player is already in queue
                const isInQueue = await this.isPlayerInQueue(playerId);
                if (isInQueue) {
                    return {
                        success: false,
                        message: "You are already in the queue.",
                    };
                }

                // Check if player is in an active match
                const isInMatch = await this.isPlayerInActiveMatch(playerId);
                if (isInMatch) {
                    return {
                        success: false,
                        message:
                            "You cannot join the queue while in an active match.",
                    };
                }

                // Check if player has 2 losses in their group - if so, reset priority
                if (groupId && this.playerGroups.has(groupId)) {
                    const losses = this.getPlayerLosses(playerId, groupId);
                    if (losses >= 2) {
                        // Player has lost twice, put them at the back of the queue
                        priority = 0;
                        logger.info(`Player ${playerId} has lost twice in group ${groupId}, queueing with priority 0`);
                    }
                }

                // Add player to queue
                await this.storage.addPlayerToQueue({
                    playerId,
                    priority,
                });

                logger.info(`Player ${playerId} added to queue with priority ${priority}`);

                // Ensure queue check is running
                if (!this.queueCheckInterval) {
                    this.startQueueCheck();
                }

                // Emit queue updated event using ES modules
                try {
                    import('../utils/eventEmitter').then(({ EventEmitter, QUEUE_EVENTS }) => {
                        const events = EventEmitter.getInstance();
                        events.emit(QUEUE_EVENTS.UPDATED);
                        events.emit(QUEUE_EVENTS.PLAYER_JOINED, playerId);
                        logger.info(`Emitted queue updated event for player ${playerId} joining`);
                    }).catch(err => {
                        logger.error(`Error importing event emitter: ${err}`);
                    });
                } catch (eventError) {
                    logger.error(`Error emitting queue event: ${eventError}`);
                }

                return {
                    success: true,
                    message: "You have been added to the queue.",
                };
            } finally {
                // Make sure we unmark the player as being processed whether or not the operation succeeded
                this.unmarkPlayerAsProcessing(playerId);
            }
        } catch (error) {
            logger.error(`Error adding player to queue: ${error}`);
            // Make sure we unmark the player if there's an exception
            this.unmarkPlayerAsProcessing(playerId);
            return {
                success: false,
                message:
                    "An error occurred while trying to add you to the queue.",
            };
        }
    }

    async removePlayerFromQueue(playerId: number): Promise<boolean> {
        const result = await this.storage.removePlayerFromQueue(playerId);

        if (result) {
            // Emit queue updated event using ES modules
            try {
                import('../utils/eventEmitter').then(({ EventEmitter, QUEUE_EVENTS }) => {
                    const events = EventEmitter.getInstance();
                    events.emit(QUEUE_EVENTS.UPDATED);
                    events.emit(QUEUE_EVENTS.PLAYER_LEFT, playerId);
                    logger.info(`Emitted queue updated event for player ${playerId} leaving`);
                }).catch(err => {
                    logger.error(`Error importing event emitter: ${err}`);
                });
            } catch (eventError) {
                logger.error(`Error emitting queue event: ${eventError}`);
            }
        }

        return result;
    }

    async isPlayerInQueue(playerId: number): Promise<boolean> {
        return this.storage.isPlayerInQueue(playerId);
    }

    async getQueuePlayers(): Promise<
        Array<{ playerId: number; joinedAt: Date; priority: number }>
    > {
        const queueEntries = await this.storage.getQueuePlayers();
        return queueEntries.map((entry) => ({
            playerId: entry.playerId,
            joinedAt: entry.joinedAt,
            priority: entry.priority,
        }));
    }

    async getQueuePlayersWithInfo(): Promise<
        Array<{
            playerId: number;
            joinedAt: Date;
            priority: number;
            player: any;
        }>
    > {
        const queueEntries = await this.storage.getQueuePlayers();
        const playersWithInfo = await Promise.all(
            queueEntries.map(async (entry) => {
                const player = await this.storage.getPlayer(entry.playerId);
                return {
                    ...entry,
                    player,
                };
            }),
        );
        return playersWithInfo;
    }

    async getAllQueueEntries(): Promise<any[]> {
        return this.storage.getQueuePlayers();
    }

    async getPlayerQueueEntry(playerId: number): Promise<any | null> {
        const queuePlayers = await this.storage.getQueuePlayers();
        return (
            queuePlayers.find((entry) => entry.playerId === playerId) || null
        );
    }

    async getQueueSize(): Promise<number> {
        const queue = await this.storage.getQueuePlayers();
        return queue.length;
    }

    async clearQueue(): Promise<void> {
        await this.storage.clearQueue();
        logger.info("Queue has been cleared");
    }

    // Use a class-level lock to prevent concurrent match creation
    private matchCreationInProgress: boolean = false;

    // Track players being processed to prevent duplicate match creation
    private playersBeingProcessed: Set<number> = new Set();

    // Track player groups and their loss counts
    private playerGroups: Map<string, Map<number, number>> = new Map();
    private currentActiveGroup: string | null = null;

    /**
     * Mark a player as being processed when they're about to be added to the queue
     * This helps prevent race conditions when players are leaving matches and being re-queued
     * @param playerId The ID of the player to mark as being processed
     */
    markPlayerAsProcessing(playerId: number): void {
        if (this.playersBeingProcessed.has(playerId)) {
            logger.info(`Player ${playerId} is already marked as being processed`);
        } else {
            this.playersBeingProcessed.add(playerId);
            logger.debug(`Marked player ${playerId} as being processed`);
        }
    }

    /**
     * Unmark a player as being processed when they're done being added to the queue
     * @param playerId The ID of the player to unmark
     */
    unmarkPlayerAsProcessing(playerId: number): void {
        if (this.playersBeingProcessed.has(playerId)) {
            this.playersBeingProcessed.delete(playerId);
            logger.debug(`Unmarked player ${playerId} as being processed`);
        }
    }

    /**
     * Generate a unique group ID for a set of players
     * @param playerIds Array of player IDs
     * @returns String group ID
     */
    private generateGroupId(playerIds: number[]): string {
        return playerIds.sort().join('-');
    }

    /**
     * Create or update a player group
     * @param playerIds Array of player IDs
     * @returns The group ID string
     */
    createPlayerGroup(playerIds: number[]): string {
        const groupId = this.generateGroupId(playerIds);
        if (!this.playerGroups.has(groupId)) {
            const playerLosses = new Map<number, number>();
            playerIds.forEach(id => playerLosses.set(id, 0));
            this.playerGroups.set(groupId, playerLosses);
        }
        this.currentActiveGroup = groupId;
        logger.info(`Created/updated player group ${groupId} with ${playerIds.length} players`);
        return groupId;
    }

    /**
     * Record a loss for a player in their group and check if they've hit the loss limit
     * @param playerId The player ID
     * @param groupId The group ID
     * @returns True if the player has hit the loss limit (2 losses)
     */
    recordPlayerLoss(playerId: number, groupId: string): boolean {
        if (!this.playerGroups.has(groupId)) {
            logger.warn(`Tried to record loss for player ${playerId} in non-existent group ${groupId}`);
            return false;
        }

        const playerLosses = this.playerGroups.get(groupId)!;
        const currentLosses = playerLosses.get(playerId) || 0;
        const newLosses = currentLosses + 1;
        playerLosses.set(playerId, newLosses);

        logger.info(`Player ${playerId} now has ${newLosses} losses in group ${groupId}`);

        return newLosses >= 2; // Return true if player has hit the loss limit
    }

    /**
     * Get current losses for a player in a group
     * @param playerId The player ID
     * @param groupId The group ID
     * @returns Number of losses, or 0 if not found
     */
    getPlayerLosses(playerId: number, groupId: string): number {
        if (!this.playerGroups.has(groupId)) {
            return 0;
        }

        const playerLosses = this.playerGroups.get(groupId)!;
        return playerLosses.get(playerId) || 0;
    }

    /**
     * Check if a group of players is still active (all players have fewer than 2 losses)
     * @param groupId The group ID
     * @returns True if the group is still active
     */
    isGroupActive(groupId: string): boolean {
        if (!this.playerGroups.has(groupId)) {
            return false;
        }

        const playerLosses = this.playerGroups.get(groupId)!;
        // Group is active if all players have fewer than 2 losses
        return Array.from(playerLosses.values()).every(losses => losses < 2);
    }

    async checkAndCreateMatch(
        guild: Guild,
        force: boolean = false,
    ): Promise<boolean> {
        // Check if match creation is already in progress
        if (this.matchCreationInProgress) {
            logger.info("Match creation already in progress, skipping this check");
            return false;
        }

        try {
            // Set the lock
            this.matchCreationInProgress = true;

            // Import the transaction utility from the db module
            const { withTransaction } = await import('../../db');

            // Perform the entire match creation process within a transaction
            return await withTransaction(async (tx) => {
                try {
                    // Get a fresh list of queued players - using transaction to ensure consistency
                    const queuedPlayers = await this.storage.getQueuePlayers(tx);
                    const botConfig = await this.storage.getBotConfig();
                    const minPlayersRequired =
                        botConfig.matchmaking.queueSizeLimits.min;

                    if (queuedPlayers.length < minPlayersRequired && !force) {
                        logger.info(
                            `Not enough players in queue to create a match: ${queuedPlayers.length}/${minPlayersRequired}`,
                        );
                        return false;
                    }

                    // Filter out players that are already being processed in another concurrent match creation
                    const availablePlayers = queuedPlayers.filter(player => !this.playersBeingProcessed.has(player.playerId));

                    if (availablePlayers.length < minPlayersRequired && !force) {
                        logger.info(
                            `Not enough available players in queue (some are already being processed): ${availablePlayers.length}/${minPlayersRequired}`,
                        );
                        return false;
                    }

                    let matchPlayers: number[] = [];

                    // Check if we have an active group with all members in the queue
                    if (this.currentActiveGroup) {
                        const groupPlayers = Array.from(this.playerGroups.get(this.currentActiveGroup)!.keys());

                        // Check if all group players are in the queue
                        const groupPlayersInQueue = groupPlayers.filter(
                            playerId => availablePlayers.some(qp => qp.playerId === playerId)
                        );

                        if (groupPlayersInQueue.length === minPlayersRequired && this.isGroupActive(this.currentActiveGroup)) {
                            logger.info(`Found active group ${this.currentActiveGroup} with all ${minPlayersRequired} players in queue`);

                            // Use the entire group for the match
                            matchPlayers = groupPlayersInQueue;

                            // Log player details
                            const playerDetails = await Promise.all(
                                matchPlayers.map(async id => {
                                    const player = await this.storage.getPlayer(id, tx);
                                    const losses = this.getPlayerLosses(id, this.currentActiveGroup!);
                                    return `${player?.username || "Unknown"} (ID: ${id}, Losses: ${losses})`;
                                })
                            );
                            logger.info(`Using group players for match: ${playerDetails.join(", ")}`);
                        }
                    }

                    // If we don't have a full group, select players normally
                    if (matchPlayers.length < minPlayersRequired) {
                        // Sort by priority and join time
                        const sortedPlayers = availablePlayers.sort((a, b) => {
                            if (a.priority !== b.priority) {
                                return b.priority - a.priority; // Higher priority first
                            }
                            return a.joinedAt.getTime() - b.joinedAt.getTime(); // Earlier join time first
                        });

                        // Take the required number of players
                        const matchPlayerEntries = sortedPlayers.slice(0, minPlayersRequired);
                        matchPlayers = matchPlayerEntries.map(entry => entry.playerId);

                        // Create a new player group for these players
                        const groupId = this.createPlayerGroup(matchPlayers);
                        logger.info(`Created new player group ${groupId} for match`);
                    }

                    // *** CRITICAL CHANGE: Mark players as being processed AND remove them from the queue
                    // before any other process can select them 

                    // First mark these players as being processed in memory
                    for (const playerId of matchPlayers) {
                        this.markPlayerAsProcessing(playerId);
                    }

                    logger.info(`Selected ${matchPlayers.length} players for match creation: ${matchPlayers.join(', ')}`);

                    // Immediately remove players from queue WITHIN the transaction - this ensures atomicity
                    // and prevents other concurrent queue checks from selecting the same players
                    logger.info(`Batch removing ${matchPlayers.length} players from queue within transaction`);
                    try {
                        const batchRemoveResult = await batchRemovePlayersFromQueue(matchPlayers, tx);
                        if (!batchRemoveResult.success) {
                            logger.warn(`Failed to batch remove players from queue: ${batchRemoveResult.message}`);
                            throw new Error(`Failed to batch remove players from queue: ${batchRemoveResult.message}`);
                        }
                    } catch (error) {
                        logger.error(`Error in batch player removal: ${error}`);
                        throw error;
                    }

                    // Log the selected players with their details for debugging
                    const playerDetails = await Promise.all(
                        matchPlayers.map(async id => {
                            const player = await this.storage.getPlayer(id, tx);
                            return `${player?.username || "Unknown"} (ID: ${id})`;
                        })
                    );
                    logger.info(`Creating match with players: ${playerDetails.join(", ")}`);

                    // Import the transaction function from matchService
                    const { createMatchWithPlayersTransaction } = await import('./matchService');

                    // Create the match - passing the transaction to ensure everything is in the same transaction
                    const matchResult = await createMatchWithPlayersTransaction(
                        matchPlayers,
                        guild,
                        this.storage,
                        tx
                    );

                    if (!matchResult.success) {
                        logger.error(`Failed to create match within transaction: ${matchResult.message}`);
                        throw new Error(`Match creation failed: ${matchResult.message}`);
                    }

                    logger.info(`Match created with ${matchPlayers.length} players (Match ID: ${matchResult.matchId})`);

                    // Emit match created event using ES modules
                    try {
                        import('../utils/eventEmitter').then(({ EventEmitter, MATCH_EVENTS }) => {
                            const events = EventEmitter.getInstance();
                            events.emit(MATCH_EVENTS.CREATED, matchResult.matchId);
                            logger.info(`Emitted match created event for match ${matchResult.matchId}`);
                        }).catch(err => {
                            logger.error(`Error importing event emitter: ${err}`);
                        });
                    } catch (eventError) {
                        logger.error(`Error emitting match created event: ${eventError}`);
                    }

                    // If we get here, the transaction will commit automatically
                    return true;
                } catch (error) {
                    // The transaction will be rolled back automatically
                    logger.error(`Transaction failed during match creation: ${error}`);
                    throw error; // Re-throw to roll back the transaction
                } finally {
                    // In case of error, ensure we unmark all players we tried to process
                    for (const playerId of matchPlayers || []) {
                        this.unmarkPlayerAsProcessing(playerId);
                    }
                }
            }).catch(error => {
                logger.error(`Match creation transaction failed: ${error}`);
                return false;
            });
        } catch (error) {
            logger.error(`Error checking and creating match: ${error}`);

            // If we have set any players as being processed, we need to clear them
            this.playersBeingProcessed.clear();

            return false;
        } finally {
            // Always release the lock when done
            this.matchCreationInProgress = false;
        }
    }
}

// We now use getDiscordBot imported from '../../index.bot' instead of this placeholder

// Import db directly at the module level to avoid require statement
import { db } from '../../db';

/**
 * Batch remove multiple players from the queue in a single operation
 * @param playerIds Array of player IDs to remove from queue
 * @param tx Optional transaction object
 * @returns Success status and message
 */
async function batchRemovePlayersFromQueue(
    playerIds: number[],
    tx?: any
): Promise<{ success: boolean; message: string }> {
        try {
            if (playerIds.length === 0) {
                return { success: true, message: "No players to remove" };
            }

            // Use storage's direct DB access to perform a batch delete
            // This reduces multiple single-row deletes to one operation
            const dbClient = tx || db;

            // First verify all players are in queue
            for (const playerId of playerIds) {
                const [entry] = await dbClient
                    .select()
                    .from(queue)
                    .where(eq(queue.playerId, playerId));

                if (!entry) {
                    return { 
                        success: false, 
                        message: `Player ${playerId} not found in queue during batch removal verification`
                    };
                }
            }

            // Then perform a single batch delete operation for all players
            await dbClient
                .delete(queue)
                .where(inArray(queue.playerId, playerIds));

            logger.info(`Successfully batch removed ${playerIds.length} players from queue`);
            return { success: true, message: `Removed ${playerIds.length} players from queue` };
        } catch (error) {
            logger.error(`Error in batch queue removal: ${error}`);
            return { 
                success: false, 
                message: `Database error during batch removal: ${error}`
            };
        }
    }