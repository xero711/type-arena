import { randomUUID } from 'node:crypto';
import { pgEnum, pgTable, text, integer, boolean, timestamp, uniqueIndex, index, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import type { GachaResponse } from '../economy/gacha.js';

export const rarityEnum = pgEnum('item_rarity', ['normal', 'rare', 'super_rare', 'hyper_rare', 'ultimate_rare']);
export const itemTypeEnum = pgEnum('item_type', ['weapon', 'armor', 'accessory']);
export const matchResultEnum = pgEnum('match_result', ['win', 'lose', 'draw', 'disconnect']);
export const matchModeEnum = pgEnum('match_mode', ['ranked', 'private']);

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  firebaseUid: text('firebase_uid').notNull().unique(),
  displayName: text('display_name').notNull(),
  photoUrl: text('photo_url'),
  rating: integer('rating').notNull().default(500),
  placementMatches: integer('placement_matches').notNull().default(0),
  coins: integer('coins').notNull().default(0),
  selectedCharacter: text('selected_character').notNull().default('balanced'),
  growthPoints: integer('growth_points').notNull().default(0),
  attackLevel: integer('attack_level').notNull().default(0),
  defenseLevel: integer('defense_level').notNull().default(0),
  magicAttackLevel: integer('magic_attack_level').notNull().default(0),
  magicDefenseLevel: integer('magic_defense_level').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable('items', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  type: itemTypeEnum('type').notNull(),
  rarity: rarityEnum('rarity').notNull(),
  attack: integer('attack').notNull().default(0),
  defense: integer('defense').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
});

export const inventory = pgTable('inventory', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id),
  quantity: integer('quantity').notNull().default(1),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.itemId] })]);

export const equipment = pgTable('equipment', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slot: itemTypeEnum('slot').notNull(),
  itemId: text('item_id').notNull().references(() => items.id),
  equippedAt: timestamp('equipped_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.slot] })]);

export const matches = pgTable('matches', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  mode: matchModeEnum('mode').notNull().default('ranked'),
  playerOneId: text('player_one_id').notNull().references(() => users.id),
  playerTwoId: text('player_two_id').notNull().references(() => users.id),
  winnerId: text('winner_id').references(() => users.id),
  playerOneResult: matchResultEnum('player_one_result').notNull(),
  playerOneWpm: integer('player_one_wpm').notNull(),
  playerTwoWpm: integer('player_two_wpm').notNull(),
  playerOneAccuracy: integer('player_one_accuracy').notNull(),
  playerTwoAccuracy: integer('player_two_accuracy').notNull(),
  playerOneCharacters: integer('player_one_characters').notNull().default(0),
  playerTwoCharacters: integer('player_two_characters').notNull().default(0),
  playerOneMistakes: integer('player_one_mistakes').notNull().default(0),
  playerTwoMistakes: integer('player_two_mistakes').notNull().default(0),
  playerOneMaxCombo: integer('player_one_max_combo').notNull().default(0),
  playerTwoMaxCombo: integer('player_two_max_combo').notNull().default(0),
  playerOneRatingChange: integer('player_one_rating_change').notNull(),
  playerTwoRatingChange: integer('player_two_rating_change').notNull(),
  playerOneCoinReward: integer('player_one_coin_reward').notNull(),
  playerTwoCoinReward: integer('player_two_coin_reward').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('matches_player_one_completed_idx').on(table.playerOneId, table.completedAt), index('matches_player_two_completed_idx').on(table.playerTwoId, table.completedAt)]);

export const gachaPulls = pgTable('gacha_pulls', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull().references(() => items.id),
  cost: integer('cost').notNull(),
  pulledAt: timestamp('pulled_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('gacha_pulls_user_pulled_idx').on(table.userId, table.pulledAt)]);

export const gachaRequests = pgTable('gacha_requests', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  idempotencyKey: text('idempotency_key').notNull(),
  count: integer('count').notNull(),
  response: jsonb('response').$type<GachaResponse>(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('gacha_requests_user_key_unique').on(table.userId, table.idempotencyKey)]);

export const coinLedger = pgTable('coin_ledger', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  referenceId: text('reference_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('coin_ledger_reason_reference_unique').on(table.userId, table.reason, table.referenceId), index('coin_ledger_user_created_idx').on(table.userId, table.createdAt)]);
