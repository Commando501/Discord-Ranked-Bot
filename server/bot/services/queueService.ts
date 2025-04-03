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
        } catch (error) {
            logger.error(`Error adding player to queue: ${error}`);
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

    async checkAndCreateMatch(
        guild: Guild,
        force: boolean = false,
    ): Promise<boolean> {
        try {
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

            // Take the required number of players (using config from JSON file)
            const matchPlayers = sortedPlayers
                .slice(0, minPlayersRequired)
                .map((entry) => entry.playerId);

            // Create the match
            const result = await this.matchService.createMatchWithPlayers(
                matchPlayers,
                guild,
            );

            if (!result.success) {
                logger.error(`Failed to create match: ${result.message}`);
                return false;
            }

            // Remove players from queue
            for (const playerId of matchPlayers) {
                await this.removePlayerFromQueue(playerId);
            }

            logger.info(`Match created with ${matchPlayers.length} players`);
            return true;
        } catch (error) {
            logger.error(`Error checking and creating match: ${error}`);
            return false;
        }
    }
}

// We now use getDiscordBot imported from '../../index.bot' instead of this placeholder
