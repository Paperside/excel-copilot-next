/**
 * Database schema for Excel Copilot
 * Using Drizzle ORM with PostgreSQL
 */
import { pgTable, uuid, varchar, text, timestamp, boolean, bigint, jsonb } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLogin: timestamp('last_login'),
  isActive: boolean('is_active').default(true).notNull(),
});

// User files table
export const userFiles = pgTable('user_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  s3Key: text('s3_key').notNull(), // e.g., "uploads/1234567890-abc.xlsx"
  originalName: varchar('original_name', { length: 500 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  source: varchar('source', { length: 50 }).notNull(), // 'upload' or 'generated'
  uploadTime: timestamp('upload_time').defaultNow().notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  metadata: jsonb('metadata'), // Extra info like sheet names, row count, etc.
});

// Chat sessions table
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  threadId: uuid('thread_id').notNull(), // Maps to Mastra's thread.id
  title: varchar('title', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Session files association (which files are used in a session)
export const sessionFiles = pgTable('session_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  fileId: uuid('file_id').references(() => userFiles.id, { onDelete: 'cascade' }).notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

// App configuration table
export const appConfig = pgTable('app_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserFile = typeof userFiles.$inferSelect;
export type NewUserFile = typeof userFiles.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
