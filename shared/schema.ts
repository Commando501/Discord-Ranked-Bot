import { pgTable, text, serial, integer, boolean, timestamp, primaryKey, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Player model
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  discriminator: text("discriminator").notNull(),
  avatar: text("avatar"),
  mmr: integer("mmr").notNull().default(1000),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  lossStreak: integer("loss_streak").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
});

// Queue model
export const queue = pgTable("queue", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  priority: integer("priority").notNull().default(0),
});

export const insertQueueSchema = createInsertSchema(queue).omit({
  id: true,
  joinedAt: true,
});

// Match model
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(), // WAITING, ACTIVE, COMPLETED, CANCELLED
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  winningTeamId: integer("winning_team_id"),
  channelId: text("channel_id"), // Discord channel ID
  categoryId: text("category_id"), // Discord category ID
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
  finishedAt: true,
  winningTeamId: true,
  channelId: true,
  categoryId: true,
});

// Team model
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  name: text("name").notNull(),
  avgMMR: integer("avg_mmr").notNull(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
});

// TeamPlayer model (join table for teams and players)
export const teamPlayers = pgTable("team_players", {
  teamId: integer("team_id").notNull().references(() => teams.id),
  playerId: integer("player_id").notNull().references(() => players.id),
}, (t) => ({
  pk: primaryKey(t.teamId, t.playerId),
}));

export const insertTeamPlayerSchema = createInsertSchema(teamPlayers);

// MatchVotes model
export const matchVotes = pgTable("match_votes", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  votedTeamId: integer("voted_team_id").notNull().references(() => teams.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMatchVoteSchema = createInsertSchema(matchVotes).omit({
  id: true,
  createdAt: true,
});

// VoteKick model
export const voteKicks = pgTable("vote_kicks", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  targetPlayerId: integer("target_player_id").notNull().references(() => players.id),
  initiatorPlayerId: integer("initiator_player_id").notNull().references(() => players.id),
  status: text("status").notNull(), // PENDING, APPROVED, REJECTED
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const insertVoteKickSchema = createInsertSchema(voteKicks).omit({
  id: true,
  createdAt: true,
  finishedAt: true,
});

// VoteKickVote model
export const voteKickVotes = pgTable("vote_kick_votes", {
  id: serial("id").primaryKey(),
  voteKickId: integer("vote_kick_id").notNull().references(() => voteKicks.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  approve: boolean("approve").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoteKickVoteSchema = createInsertSchema(voteKickVotes).omit({
  id: true,
  createdAt: true,
});

// Relations
export const playersRelations = relations(players, ({ many }) => ({
  queueEntries: many(queue),
  teamPlayers: many(teamPlayers),
  matchVotes: many(matchVotes),
  voteKicks: many(voteKicks, { relationName: "targetPlayer" }),
  initiatedVoteKicks: many(voteKicks, { relationName: "initiatorPlayer" }),
  voteKickVotes: many(voteKickVotes),
}));

export const queueRelations = relations(queue, ({ one }) => ({
  player: one(players, {
    fields: [queue.playerId],
    references: [players.id],
  }),
}));

export const matchesRelations = relations(matches, ({ many, one }) => ({
  teams: many(teams),
  matchVotes: many(matchVotes),
  voteKicks: many(voteKicks),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  match: one(matches, {
    fields: [teams.matchId],
    references: [matches.id],
  }),
  teamPlayers: many(teamPlayers),
  matchVotes: many(matchVotes),
}));

export const teamPlayersRelations = relations(teamPlayers, ({ one }) => ({
  team: one(teams, {
    fields: [teamPlayers.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [teamPlayers.playerId],
    references: [players.id],
  }),
}));

export const matchVotesRelations = relations(matchVotes, ({ one }) => ({
  match: one(matches, {
    fields: [matchVotes.matchId],
    references: [matches.id],
  }),
  player: one(players, {
    fields: [matchVotes.playerId],
    references: [players.id],
  }),
  votedTeam: one(teams, {
    fields: [matchVotes.votedTeamId],
    references: [teams.id],
  }),
}));

export const voteKicksRelations = relations(voteKicks, ({ one, many }) => ({
  match: one(matches, {
    fields: [voteKicks.matchId],
    references: [matches.id],
  }),
  targetPlayer: one(players, {
    fields: [voteKicks.targetPlayerId],
    references: [players.id],
    relationName: "targetPlayer",
  }),
  initiatorPlayer: one(players, {
    fields: [voteKicks.initiatorPlayerId],
    references: [players.id],
    relationName: "initiatorPlayer",
  }),
  votes: many(voteKickVotes),
}));

export const voteKickVotesRelations = relations(voteKickVotes, ({ one }) => ({
  voteKick: one(voteKicks, {
    fields: [voteKickVotes.voteKickId],
    references: [voteKicks.id],
  }),
  player: one(players, {
    fields: [voteKickVotes.playerId],
    references: [players.id],
  }),
}));

// Export types
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

export type MatchVote = typeof matchVotes.$inferSelect;
export type InsertMatchVote = z.infer<typeof insertMatchVoteSchema>;

export type VoteKick = typeof voteKicks.$inferSelect;
export type InsertVoteKick = z.infer<typeof insertVoteKickSchema>;

export type VoteKickVote = typeof voteKickVotes.$inferSelect;
export type InsertVoteKickVote = z.infer<typeof insertVoteKickVoteSchema>;

// Type definitions for Discord users
export type DiscordUser = {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string | null;
};
