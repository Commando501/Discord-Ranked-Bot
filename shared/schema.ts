import { pgTable, text, serial, integer, boolean, timestamp, json, unique, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table for authentication (existing table)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Discord Players table
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  discordUsername: text("discord_username").notNull(),
  mmr: integer("mmr").notNull().default(1000),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  lossStreak: integer("loss_streak").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  discordId: true,
  discordUsername: true,
  mmr: true,
});

// Queue table
export const queue = pgTable("queue", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  priority: integer("priority").notNull().default(0),
});

export const insertQueueSchema = createInsertSchema(queue).pick({
  playerId: true,
  priority: true,
});

// Match table
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("PENDING"), // PENDING, ACTIVE, COMPLETED
  winningTeam: integer("winning_team"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  averageMmr: integer("average_mmr"),
});

export const insertMatchSchema = createInsertSchema(matches).pick({
  status: true,
  winningTeam: true,
  averageMmr: true,
});

// Team table
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  teamNumber: integer("team_number").notNull(),
  averageMmr: integer("average_mmr"),
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  matchId: true,
  teamNumber: true,
  averageMmr: true,
});

// Team Players join table
export const teamPlayers = pgTable("team_players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  playerId: integer("player_id").notNull().references(() => players.id),
}, (table) => {
  return {
    teamPlayerUnique: unique().on(table.teamId, table.playerId),
  };
});

export const insertTeamPlayerSchema = createInsertSchema(teamPlayers).pick({
  teamId: true,
  playerId: true,
});

// Match results table for player MMR changes
export const matchResults = pgTable("match_results", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  mmrBefore: integer("mmr_before").notNull(),
  mmrAfter: integer("mmr_after").notNull(),
  mmrChange: integer("mmr_change").notNull(),
  team: integer("team").notNull(),
  won: boolean("won").notNull(),
});

export const insertMatchResultSchema = createInsertSchema(matchResults).pick({
  matchId: true,
  playerId: true,
  mmrBefore: true,
  mmrAfter: true,
  mmrChange: true,
  team: true,
  won: true,
});

// VoteKick table
export const voteKicks = pgTable("vote_kicks", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  targetPlayerId: integer("target_player_id").notNull().references(() => players.id),
  initiatorPlayerId: integer("initiator_player_id").notNull().references(() => players.id),
  teamId: integer("team_id").notNull().references(() => teams.id),
  status: text("status").notNull().default("PENDING"), // PENDING, PASSED, FAILED
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVoteKickSchema = createInsertSchema(voteKicks).pick({
  matchId: true,
  targetPlayerId: true,
  initiatorPlayerId: true,
  teamId: true,
  status: true,
});

// VoteKick votes table
export const voteKickVotes = pgTable("vote_kick_votes", {
  id: serial("id").primaryKey(),
  voteKickId: integer("vote_kick_id").notNull().references(() => voteKicks.id),
  voterId: integer("voter_id").notNull().references(() => players.id),
  vote: boolean("vote").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    voteKickVoteUnique: unique().on(table.voteKickId, table.voterId),
  };
});

export const insertVoteKickVoteSchema = createInsertSchema(voteKickVotes).pick({
  voteKickId: true,
  voterId: true,
  vote: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export type Queue = typeof queue.$inferSelect;
export type InsertQueue = z.infer<typeof insertQueueSchema>;

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;

export type MatchResult = typeof matchResults.$inferSelect;
export type InsertMatchResult = z.infer<typeof insertMatchResultSchema>;

export type VoteKick = typeof voteKicks.$inferSelect;
export type InsertVoteKick = z.infer<typeof insertVoteKickSchema>;

export type VoteKickVote = typeof voteKickVotes.$inferSelect;
export type InsertVoteKickVote = z.infer<typeof insertVoteKickVoteSchema>;
