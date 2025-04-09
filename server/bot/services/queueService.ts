import { Guild } from "discord.js";
import { IStorage } from "../../storage";
import { logger } from "../utils/logger";
import { MatchService } from "./matchService";
import { BotConfig } from "@shared/botConfig";
import { getBot as getDiscordBot } from "../../index.bot";

export class QueueService {
    private storage: IStorage;
    private matchService: MatchService;
    private queueCheckInterval: NodeJS.Timeout | null = null;
    private static instance: QueueService | null = null;

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

    async addPlayerToQueue(
        playerId: number,
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

                // Add player to queue
                await this.storage.addPlayerToQueue({
                    playerId,
                    priority: 0,
                });

                logger.info(`Player ${playerId} added to queue`);

                // Ensure queue check is running
                if (!this.queueCheckInterval) {
                    this.startQueueCheck();
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
        return this.storage.removePlayerFromQueue(playerId);
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
            
            // Get a fresh list of queued players
            const queuedPlayers = await this.storage.getQueuePlayers();
            const botConfig = await this.storage.getBotConfig();
            const minPlayersRequired =
                botConfig.matchmaking.queueSizeLimits.min;

            if (queuedPlayers.length < minPlayersRequired && !force) {
                logger.info(
                    `Not enough players in queue to create a match: ${queuedPlayers.length}/${minPlayersRequired}`,
                );
                return false;
            }

            // Sort by priority and join time
            const sortedPlayers = queuedPlayers.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority; // Higher priority first
                }
                return a.joinedAt.getTime() - b.joinedAt.getTime(); // Earlier join time first
            });

            // Filter out players that are already being processed in another concurrent match creation
            const availablePlayers = sortedPlayers.filter(player => !this.playersBeingProcessed.has(player.playerId));
            
            if (availablePlayers.length < minPlayersRequired && !force) {
                logger.info(
                    `Not enough available players in queue (some are already being processed): ${availablePlayers.length}/${minPlayersRequired}`,
                );
                return false;
            }

            // Take the required number of players
            const matchPlayerEntries = availablePlayers.slice(0, minPlayersRequired);
            const matchPlayers = matchPlayerEntries.map(entry => entry.playerId);
            
            // Mark these players as being processed
            for (const playerId of matchPlayers) {
                this.markPlayerAsProcessing(playerId);
            }
            
            logger.info(`Selected ${matchPlayers.length} players for match creation: ${matchPlayers.join(', ')}`);
            
            // Double-check that all players are still in queue
            let allPlayersAvailable = true;
            for (const playerId of matchPlayers) {
                const stillInQueue = await this.isPlayerInQueue(playerId);
                if (!stillInQueue) {
                    logger.warn(`Player ${playerId} was in queue when checked but is no longer present. Aborting match creation.`);
                    allPlayersAvailable = false;
                    break;
                }
            }

            if (!allPlayersAvailable) {
                // Release these players from being processed
                for (const playerId of matchPlayers) {
                    this.unmarkPlayerAsProcessing(playerId);
                }
                return false;
            }

            // Log the selected players with their details for debugging
            const playerDetails = await Promise.all(
                matchPlayers.map(async id => {
                    const player = await this.storage.getPlayer(id);
                    return `${player?.username || "Unknown"} (ID: ${id})`;
                })
            );
            logger.info(`Creating match with players: ${playerDetails.join(", ")}`);

            // Remove players from queue BEFORE creating the match to prevent race conditions
            logger.info(`Removing ${matchPlayers.length} players from queue before match creation`);
            for (const playerId of matchPlayers) {
                await this.removePlayerFromQueue(playerId);
            }

            // Create the match
            const result = await this.matchService.createMatchWithPlayers(
                matchPlayers,
                guild,
            );

            if (!result.success) {
                logger.error(`Failed to create match: ${result.message}`);
                // If match creation fails, add players back to queue
                logger.info("Match creation failed, re-adding players to queue");
                for (const playerId of matchPlayers) {
                    await this.addPlayerToQueue(playerId);
                }
                
                // Release these players from being processed
                for (const playerId of matchPlayers) {
                    this.unmarkPlayerAsProcessing(playerId);
                }
                return false;
            }

            logger.info(`Match created with ${matchPlayers.length} players (Match ID: ${result.matchId})`);
            
            // Release these players from being processed
            for (const playerId of matchPlayers) {
                this.unmarkPlayerAsProcessing(playerId);
            }
            
            return true;
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
